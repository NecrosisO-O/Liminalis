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
    const stream = Readable.from(this.readParts(parts.map((part) => part.storageKey)));

    return {
      publicLinkId: publicLink.id,
      stream,
      contentLength,
      fileName: publicLink.sourceItem.displayName ?? 'liminalis-download.bin',
    };
  }

  async completePublicDownload(publicLinkId: string) {
    const publicLink = await this.prisma.publicLink.findUnique({
      where: { id: publicLinkId },
    });

    if (!publicLink || publicLink.state !== PublicLinkState.ACTIVE) {
      return null;
    }

    const remaining = Math.max(0, publicLink.remainingDownloadCount - 1);
    const state = remaining === 0 ? PublicLinkState.EXHAUSTED : PublicLinkState.ACTIVE;

    return this.prisma.publicLink.update({
      where: { id: publicLink.id },
      data: {
        remainingDownloadCount: remaining,
        state,
      },
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

    const publicLink = await this.refreshPublicLinkState(ticket.publicLink.id);
    if (publicLink.state !== PublicLinkState.ACTIVE) {
      throw this.invalidPublicLink();
    }

    await this.prisma.publicLinkDeliveryTicket.update({
      where: { id: ticket.id },
      data: { redeemedAt: new Date() },
    });
    await this.completePublicDownload(publicLink.id);

    return {
      publicLinkId: publicLink.id,
      sourceItemId: publicLink.sourceItemId,
      storageBinding: publicLink.sourceItem.storageBinding,
      contentKind: publicLink.sourceItem.contentKind,
    };
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
