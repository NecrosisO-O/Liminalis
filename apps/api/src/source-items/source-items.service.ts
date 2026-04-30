import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/index.js';
import {
  ConfidentialityLevel,
  ExtractionAccessState,
  PublicLinkState,
  RetrievalAttemptStatus,
  ShareObjectInactiveReason,
  ShareObjectState,
  SourceItemState,
} from '../../generated/prisma/index.js';
import { PolicyService } from '../policy/policy.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectionService } from '../projections/projection.service';

@Injectable()
export class SourceItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
    private readonly projectionService: ProjectionService,
  ) {}

  async getSourceItemForOwner(userId: string, sourceItemId: string) {
    await this.refreshOwnedSourceItemAvailability(userId, sourceItemId);

    const sourceItem = await this.prisma.sourceItem.findFirst({
      where: {
        id: sourceItemId,
        ownerUserId: userId,
      },
      include: {
        groupManifest: true,
        packageFamilies: true,
        accessGrantSets: {
          where: { status: 'CURRENT' },
          include: {
            ordinaryPackageFamily: true,
            recoveryPackageFamily: true,
          },
        },
      },
    });

    if (!sourceItem) {
      throw new NotFoundException('Source item not found');
    }

    return sourceItem;
  }

  async revokeSourceItemForOwner(userId: string, sourceItemId: string) {
    const sourceItem = await this.requireOwnedSourceItem(userId, sourceItemId);

    if (sourceItem.state !== SourceItemState.ACTIVE) {
      return sourceItem;
    }

    await this.invalidateSourceItem(sourceItem.id, SourceItemState.INVALIDATED);

    return this.getSourceItemForOwner(userId, sourceItemId);
  }

  async changeConfidentialityForOwner(
    userId: string,
    sourceItemId: string,
    confidentialityLevel: ConfidentialityLevel,
  ) {
    const sourceItem = await this.requireOwnedSourceItem(userId, sourceItemId);

    if (sourceItem.state !== SourceItemState.ACTIVE) {
      throw new BadRequestException('Inactive source items cannot change confidentiality');
    }

    const decision = await this.policyService.evaluateSourceCreation({
      confidentialityLevel,
      requestedValidityMinutes: null,
      burnAfterReadEnabled: sourceItem.burnAfterReadEnabled,
      contentKind: sourceItem.contentKind,
    });

    const shareIds = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.sourceItem.update({
        where: { id: sourceItem.id },
        data: {
          confidentialityLevel,
          policyBundleId: decision.policyBundle.id,
          policySnapshot: decision.snapshotFieldsToPersist as Prisma.InputJsonValue,
        },
      });

      if (updated.confidentialityLevel === ConfidentialityLevel.TOP_SECRET) {
        return this.invalidateDerivedAccess(tx, updated.id);
      }

      return [];
    });

    await this.projectSourceAndShares(sourceItem.id, shareIds);

    return this.getSourceItemForOwner(userId, sourceItemId);
  }

  async updateValidityForOwner(
    userId: string,
    sourceItemId: string,
    requestedValidityMinutes: number | null,
  ) {
    const sourceItem = await this.requireOwnedSourceItem(userId, sourceItemId);

    if (sourceItem.state !== SourceItemState.ACTIVE) {
      throw new BadRequestException('Inactive source items cannot change validity');
    }

    const validUntil =
      requestedValidityMinutes !== null && requestedValidityMinutes > 0
        ? new Date(Date.now() + requestedValidityMinutes * 60_000)
        : null;

    await this.prisma.sourceItem.update({
      where: { id: sourceItem.id },
      data: { validUntil },
    });

    await this.projectionService.projectSourceItem(sourceItem.id);

    return this.getSourceItemForOwner(userId, sourceItemId);
  }

  async invalidateSourceItem(sourceItemId: string, state: SourceItemState) {
    const shareIds = await this.prisma.$transaction(async (tx) => {
      await tx.sourceItem.update({
        where: { id: sourceItemId },
        data: { state },
      });

      return this.invalidateDerivedAccess(tx, sourceItemId);
    });

    await this.projectSourceAndShares(sourceItemId, shareIds);
  }

  private async refreshOwnedSourceItemAvailability(userId: string, sourceItemId: string) {
    const sourceItem = await this.prisma.sourceItem.findFirst({
      where: { id: sourceItemId, ownerUserId: userId },
      select: { id: true, state: true, validUntil: true },
    });

    if (
      sourceItem?.state === SourceItemState.ACTIVE &&
      sourceItem.validUntil &&
      sourceItem.validUntil < new Date()
    ) {
      await this.invalidateSourceItem(sourceItem.id, SourceItemState.EXPIRED);
    }
  }

  private async requireOwnedSourceItem(userId: string, sourceItemId: string) {
    const sourceItem = await this.prisma.sourceItem.findFirst({
      where: { id: sourceItemId, ownerUserId: userId },
    });

    if (!sourceItem) {
      throw new NotFoundException('Source item not found');
    }

    return sourceItem;
  }

  private async invalidateDerivedAccess(
    tx: Prisma.TransactionClient,
    sourceItemId: string,
  ) {
    const shares = await tx.shareObject.findMany({
      where: { sourceItemId },
      select: { id: true },
    });
    const shareIds = shares.map((share) => share.id);

    if (shareIds.length > 0) {
      await tx.shareObject.updateMany({
        where: { id: { in: shareIds }, state: ShareObjectState.ACTIVE },
        data: {
          state: ShareObjectState.INACTIVE,
          inactiveReason: ShareObjectInactiveReason.SOURCE_INVALIDATED,
        },
      });

      await tx.extractionAccess.updateMany({
        where: {
          OR: [
            { sourceItemId },
            { shareObjectId: { in: shareIds } },
          ],
        },
        data: { state: ExtractionAccessState.INVALIDATED },
      });

      await tx.publicLink.updateMany({
        where: {
          OR: [
            { sourceItemId },
            { shareObjectId: { in: shareIds } },
          ],
        },
        data: { state: PublicLinkState.INVALIDATED },
      });

      await tx.retrievalAttempt.updateMany({
        where: {
          OR: [
            { sourceItemId },
            { shareObjectId: { in: shareIds } },
          ],
          status: { in: [RetrievalAttemptStatus.ISSUED, RetrievalAttemptStatus.IN_PROGRESS] },
        },
        data: { status: RetrievalAttemptStatus.ABANDONED },
      });
    } else {
      await tx.extractionAccess.updateMany({
        where: { sourceItemId },
        data: { state: ExtractionAccessState.INVALIDATED },
      });

      await tx.publicLink.updateMany({
        where: { sourceItemId },
        data: { state: PublicLinkState.INVALIDATED },
      });

      await tx.retrievalAttempt.updateMany({
        where: {
          sourceItemId,
          status: { in: [RetrievalAttemptStatus.ISSUED, RetrievalAttemptStatus.IN_PROGRESS] },
        },
        data: { status: RetrievalAttemptStatus.ABANDONED },
      });
    }

    return shareIds;
  }

  private async projectSourceAndShares(sourceItemId: string, shareIds: string[]) {
    await this.projectionService.projectSourceItem(sourceItemId);
    await Promise.all(shareIds.map((shareId) => this.projectionService.projectShareObject(shareId)));
  }
}
