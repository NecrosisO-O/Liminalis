import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Readable } from 'stream';
import {
  PublicLinkState,
  SourceItemState,
  UploadContentKind,
} from '../../generated/prisma/index.js';
import { PolicyService } from '../policy/policy.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreatePublicLinkDto } from './dto/create-public-link.dto';

@Injectable()
export class PublicLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
    private readonly storageService: StorageService,
  ) {}

  async createPublicLink(ownerUserId: string, input: CreatePublicLinkDto) {
    const sourceItem = await this.prisma.sourceItem.findFirst({
      where: {
        id: input.sourceItemId,
        ownerUserId,
      },
    });

    if (!sourceItem) {
      throw new NotFoundException('Source item not found');
    }

    if (sourceItem.state !== SourceItemState.ACTIVE) {
      throw new BadRequestException('Source item is not eligible for public links');
    }

    if (sourceItem.validUntil && sourceItem.validUntil < new Date()) {
      await this.prisma.sourceItem.update({
        where: { id: sourceItem.id },
        data: { state: SourceItemState.EXPIRED },
      });
      throw new BadRequestException('Source item expired');
    }

    if (sourceItem.contentKind === UploadContentKind.SELF_SPACE_TEXT) {
      throw new BadRequestException('Text items cannot be linked outward in v1');
    }

    const decision = await this.policyService.evaluatePublicLinkCreation({
      confidentialityLevel: sourceItem.confidentialityLevel,
      requestedValidityMinutes: input.requestedValidityMinutes ?? null,
      requestedDownloadCount: input.requestedDownloadCount ?? null,
    });
    const candidateValidUntil = decision.resolvedValidityMinutes
      ? new Date(Date.now() + decision.resolvedValidityMinutes * 60_000)
      : null;

    const publicLink = await this.prisma.publicLink.create({
      data: {
        sourceItemId: sourceItem.id,
        policyBundleId: decision.policyBundle.id,
        policySnapshot: decision.snapshotFieldsToPersist,
        state: PublicLinkState.ACTIVE,
        linkToken: crypto.randomUUID(),
        configuredDownloadCount: decision.resolvedDownloadCount,
        remainingDownloadCount: decision.resolvedDownloadCount,
        validUntil: this.clampValidUntil(candidateValidUntil, sourceItem.validUntil),
      },
    });

    return {
      publicLinkId: publicLink.id,
      linkToken: publicLink.linkToken,
      remainingDownloadCount: publicLink.remainingDownloadCount,
      validUntil: publicLink.validUntil,
    };
  }

  async createPublicDownload(linkToken: string) {
    const publicLink = await this.refreshPublicLinkStateByToken(linkToken);

    if (publicLink.state !== PublicLinkState.ACTIVE) {
      throw this.invalidPublicLink();
    }

    const parts = this.extractStorageParts(publicLink.sourceItem.storageBinding);
    const contentLength = parts.reduce((sum, part) => sum + part.byteSize, 0);

    const reservation = await this.reservePublicDownload(publicLink.id);
    if (!reservation) {
      throw this.invalidPublicLink();
    }

    const stream = Readable.from(this.readParts(parts.map((part) => part.storageKey)));

    return {
      publicLinkId: publicLink.id,
      reservationTicketToken: reservation.ticketToken,
      stream,
      contentLength,
      fileName: publicLink.sourceItem.displayName ?? 'liminalis-download.bin',
    };
  }

  async finishPublicDownload(ticketToken: string) {
    return this.prisma.publicLinkDeliveryTicket.updateMany({
      where: {
        ticketToken,
        redeemedAt: null,
      },
      data: { redeemedAt: new Date() },
    });
  }

  async releasePublicDownload(ticketToken: string) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.publicLinkDeliveryTicket.findUnique({
        where: { ticketToken },
        include: {
          publicLink: {
            include: { sourceItem: true },
          },
        },
      });

      if (!ticket || ticket.redeemedAt) {
        return null;
      }

      await tx.publicLinkDeliveryTicket.delete({ where: { id: ticket.id } });

      const canReactivate =
        ticket.publicLink.state === PublicLinkState.EXHAUSTED &&
        ticket.publicLink.sourceItem.state === SourceItemState.ACTIVE &&
        (!ticket.publicLink.sourceItem.validUntil ||
          ticket.publicLink.sourceItem.validUntil >= new Date()) &&
        (!ticket.publicLink.validUntil || ticket.publicLink.validUntil >= new Date());

      return tx.publicLink.update({
        where: { id: ticket.publicLinkId },
        data: {
          remainingDownloadCount: { increment: 1 },
          state: canReactivate ? PublicLinkState.ACTIVE : ticket.publicLink.state,
        },
      });
    });
  }

  private async reservePublicDownload(publicLinkId: string) {
    return this.prisma.$transaction(async (tx) => {
      const update = await tx.publicLink.updateMany({
        where: {
          id: publicLinkId,
          state: PublicLinkState.ACTIVE,
          remainingDownloadCount: { gt: 0 },
        },
        data: {
          remainingDownloadCount: { decrement: 1 },
        },
      });

      if (update.count !== 1) {
        return null;
      }

      const refreshed = await tx.publicLink.findUniqueOrThrow({
        where: { id: publicLinkId },
        select: { remainingDownloadCount: true },
      });

      if (refreshed.remainingDownloadCount <= 0) {
        await tx.publicLink.update({
          where: { id: publicLinkId },
          data: { state: PublicLinkState.EXHAUSTED },
        });
      }

      return tx.publicLinkDeliveryTicket.create({
        data: {
          publicLinkId,
          ticketToken: crypto.randomUUID(),
          expiresAt: new Date(Date.now() + 10 * 60_000),
        },
      });
    });
  }

  async issueDeliveryTicket(linkToken: string) {
    const publicLink = await this.refreshPublicLinkStateByToken(linkToken);

    if (publicLink.state !== PublicLinkState.ACTIVE) {
      throw this.invalidPublicLink();
    }

    const ticket = await this.prisma.publicLinkDeliveryTicket.create({
      data: {
        publicLinkId: publicLink.id,
        ticketToken: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });

    return {
      ticketToken: ticket.ticketToken,
      expiresAt: ticket.expiresAt,
    };
  }

  async redeemDeliveryTicket(ticketToken: string) {
    const ticket = await this.prisma.publicLinkDeliveryTicket.findUnique({
      where: { ticketToken },
      include: {
        publicLink: {
          include: {
            sourceItem: true,
          },
        },
      },
    });

    if (!ticket || ticket.expiresAt < new Date() || ticket.redeemedAt) {
      throw this.invalidPublicLink();
    }

    const publicLink = await this.redeemIssuedTicket(ticket.id, ticket.publicLink.id);

    return {
      publicLinkId: publicLink.id,
      sourceItemId: publicLink.sourceItemId,
      storageBinding: publicLink.sourceItem.storageBinding,
      contentKind: publicLink.sourceItem.contentKind,
    };
  }

  private async redeemIssuedTicket(ticketId: string, publicLinkId: string) {
    return this.prisma.$transaction(async (tx) => {
      const publicLink = await tx.publicLink.findUniqueOrThrow({
        where: { id: publicLinkId },
        include: { sourceItem: true },
      });

      if (
        publicLink.state !== PublicLinkState.ACTIVE ||
        publicLink.sourceItem.state !== SourceItemState.ACTIVE ||
        (publicLink.sourceItem.validUntil && publicLink.sourceItem.validUntil < new Date()) ||
        (publicLink.validUntil && publicLink.validUntil < new Date()) ||
        publicLink.remainingDownloadCount <= 0
      ) {
        throw this.invalidPublicLink();
      }

      const ticketUpdate = await tx.publicLinkDeliveryTicket.updateMany({
        where: {
          id: ticketId,
          redeemedAt: null,
          expiresAt: { gte: new Date() },
        },
        data: { redeemedAt: new Date() },
      });

      if (ticketUpdate.count !== 1) {
        throw this.invalidPublicLink();
      }

      const linkUpdate = await tx.publicLink.updateMany({
        where: {
          id: publicLinkId,
          state: PublicLinkState.ACTIVE,
          remainingDownloadCount: { gt: 0 },
        },
        data: {
          remainingDownloadCount: { decrement: 1 },
        },
      });

      if (linkUpdate.count !== 1) {
        throw this.invalidPublicLink();
      }

      const refreshed = await tx.publicLink.findUniqueOrThrow({
        where: { id: publicLinkId },
        include: { sourceItem: true },
      });

      if (refreshed.remainingDownloadCount <= 0) {
        return tx.publicLink.update({
          where: { id: publicLinkId },
          data: { state: PublicLinkState.EXHAUSTED },
          include: { sourceItem: true },
        });
      }

      return refreshed;
    });
  }

  private async refreshPublicLinkStateByToken(linkToken: string) {
    const publicLink = await this.prisma.publicLink.findUnique({ where: { linkToken } });

    if (!publicLink) {
      throw this.invalidPublicLink();
    }

    return this.refreshPublicLinkState(publicLink.id);
  }

  private async refreshPublicLinkState(publicLinkId: string) {
    const publicLink = await this.prisma.publicLink.findUniqueOrThrow({
      where: { id: publicLinkId },
      include: {
        sourceItem: true,
      },
    });

    let nextState = publicLink.state;

    if (publicLink.sourceItem.state !== SourceItemState.ACTIVE) {
      nextState = PublicLinkState.INVALIDATED;
    } else if (publicLink.sourceItem.validUntil && publicLink.sourceItem.validUntil < new Date()) {
      nextState = PublicLinkState.INVALIDATED;
    } else if (publicLink.validUntil && publicLink.validUntil < new Date()) {
      nextState = PublicLinkState.EXPIRED;
    } else if (publicLink.remainingDownloadCount <= 0) {
      nextState = PublicLinkState.EXHAUSTED;
    }

    if (nextState !== publicLink.state) {
      return this.prisma.publicLink.update({
        where: { id: publicLink.id },
        data: { state: nextState },
        include: { sourceItem: true },
      });
    }

    return publicLink;
  }

  private extractStorageParts(storageBinding: unknown) {
    if (!storageBinding || typeof storageBinding !== 'object' || !('parts' in storageBinding)) {
      throw this.invalidPublicLink();
    }

    const parts = (storageBinding as { parts?: unknown }).parts;
    if (!Array.isArray(parts) || parts.length === 0) {
      throw this.invalidPublicLink();
    }

    return parts.map((part) => {
      if (
        !part ||
        typeof part !== 'object' ||
        typeof (part as { storageKey?: unknown }).storageKey !== 'string' ||
        typeof (part as { byteSize?: unknown }).byteSize !== 'number'
      ) {
        throw this.invalidPublicLink();
      }

      return {
        storageKey: (part as { storageKey: string }).storageKey,
        byteSize: (part as { byteSize: number }).byteSize,
      };
    });
  }

  private async *readParts(storageKeys: string[]) {
    for (const storageKey of storageKeys) {
      const stream = this.storageService.createReadStream(storageKey);
      for await (const chunk of stream) {
        yield chunk;
      }
    }
  }

  private clampValidUntil(candidate: Date | null, sourceValidUntil: Date | null) {
    if (!candidate) {
      return sourceValidUntil;
    }

    if (!sourceValidUntil) {
      return candidate;
    }

    return candidate < sourceValidUntil ? candidate : sourceValidUntil;
  }

  private invalidPublicLink() {
    return new NotFoundException('Public link is invalid');
  }
}
