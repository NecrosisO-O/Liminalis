import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PublicLinkState, ShareObjectState } from '../../generated/prisma/index.js';
import { PolicyService } from '../policy/policy.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePublicLinkDto } from './dto/create-public-link.dto';

@Injectable()
export class PublicLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
  ) {}

  async createPublicLink(ownerUserId: string, input: CreatePublicLinkDto) {
    const share = await this.prisma.shareObject.findFirst({
      where: {
        id: input.shareObjectId,
        ownerUserId,
      },
    });

    if (!share) {
      throw new NotFoundException('Share object not found');
    }

    if (share.state !== ShareObjectState.ACTIVE) {
      throw new BadRequestException('Share object is not eligible for public links');
    }

    const decision = await this.policyService.evaluatePublicLinkCreation({
      confidentialityLevel: share.confidentialityLevel,
      requestedValidityMinutes: input.requestedValidityMinutes ?? null,
      requestedDownloadCount: input.requestedDownloadCount ?? null,
    });

    const publicLink = await this.prisma.publicLink.create({
      data: {
        shareObjectId: share.id,
        policyBundleId: decision.policyBundle.id,
        policySnapshot: decision.snapshotFieldsToPersist,
        state: PublicLinkState.ACTIVE,
        linkToken: crypto.randomUUID(),
        configuredDownloadCount: decision.resolvedDownloadCount,
        remainingDownloadCount: decision.resolvedDownloadCount,
        validUntil: decision.resolvedValidityMinutes
          ? new Date(Date.now() + decision.resolvedValidityMinutes * 60_000)
          : share.validUntil,
      },
    });

    return {
      publicLinkId: publicLink.id,
      linkToken: publicLink.linkToken,
      remainingDownloadCount: publicLink.remainingDownloadCount,
      validUntil: publicLink.validUntil,
    };
  }

  async getPublicLink(linkToken: string) {
    const publicLink = await this.refreshPublicLinkStateByToken(linkToken);

    return {
      publicLinkId: publicLink.id,
      state: publicLink.state,
      validUntil: publicLink.validUntil,
      remainingDownloadCount: publicLink.remainingDownloadCount,
    };
  }

  async issueDeliveryTicket(linkToken: string) {
    const publicLink = await this.refreshPublicLinkStateByToken(linkToken);

    if (publicLink.state !== PublicLinkState.ACTIVE) {
      throw new BadRequestException('Public link is not downloadable');
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
            shareObject: {
              include: {
                sourceItem: true,
              },
            },
          },
        },
      },
    });

    if (!ticket || ticket.expiresAt < new Date()) {
      throw new NotFoundException('Delivery ticket not found');
    }

    const publicLink = await this.refreshPublicLinkState(ticket.publicLink.id);
    if (publicLink.state !== PublicLinkState.ACTIVE) {
      throw new BadRequestException('Public link is not downloadable');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.publicLinkDeliveryTicket.update({
        where: { id: ticket.id },
        data: { redeemedAt: new Date() },
      });

      const remaining = Math.max(0, publicLink.remainingDownloadCount - 1);
      const state = remaining === 0 ? PublicLinkState.EXHAUSTED : PublicLinkState.ACTIVE;

      return tx.publicLink.update({
        where: { id: publicLink.id },
        data: {
          remainingDownloadCount: remaining,
          state,
        },
        include: {
          shareObject: {
            include: {
              sourceItem: true,
            },
          },
        },
      });
    });

    return {
      publicLinkId: updated.id,
      state: updated.state,
      remainingDownloadCount: updated.remainingDownloadCount,
      sourceItemId: updated.shareObject.sourceItemId,
      storageBinding: updated.shareObject.sourceItem.storageBinding,
      textCiphertextBody: updated.shareObject.sourceItem.textCiphertextBody,
      contentKind: updated.shareObject.sourceItem.contentKind,
    };
  }

  private async refreshPublicLinkStateByToken(linkToken: string) {
    const publicLink = await this.prisma.publicLink.findUnique({ where: { linkToken } });

    if (!publicLink) {
      throw new NotFoundException('Public link not found');
    }

    return this.refreshPublicLinkState(publicLink.id);
  }

  private async refreshPublicLinkState(publicLinkId: string) {
    const publicLink = await this.prisma.publicLink.findUniqueOrThrow({
      where: { id: publicLinkId },
      include: {
        shareObject: true,
      },
    });

    let nextState = publicLink.state;

    if (publicLink.shareObject.state !== ShareObjectState.ACTIVE) {
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
      });
    }

    return publicLink;
  }
}
