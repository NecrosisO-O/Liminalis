import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/index.js';
import {
  AccessGrantSubjectMode,
  PackageFamilyKind,
  ProtectedObjectType,
  RetrievalAttemptStatus,
  RetrievalFamily,
  SourceItemState,
} from '../../generated/prisma/index.js';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectionService } from '../projections/projection.service';

@Injectable()
export class RetrievalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectionService: ProjectionService,
  ) {}

  async issueSourceItemRetrieval(
    userId: string,
    trustedDeviceId: string | null,
    sourceItemId: string,
    attemptScopeKey: string,
  ) {
    if (!trustedDeviceId) {
      throw new ForbiddenException('Trusted device required');
    }

    const sourceItem = await this.prisma.sourceItem.findFirst({
      where: {
        id: sourceItemId,
        ownerUserId: userId,
      },
      include: {
        accessGrantSets: {
          where: { status: 'CURRENT' },
          include: {
            ordinaryPackageFamily: true,
          },
        },
      },
    });

    if (!sourceItem) {
      throw new NotFoundException('Source item not found');
    }

    if (sourceItem.state !== SourceItemState.ACTIVE) {
      throw new BadRequestException('Source item is not retrievable');
    }

    if (sourceItem.validUntil && sourceItem.validUntil < new Date()) {
      await this.prisma.sourceItem.update({
        where: { id: sourceItem.id },
        data: { state: SourceItemState.EXPIRED },
      });

      throw new BadRequestException('Source item expired');
    }

    const grantSet = sourceItem.accessGrantSets[0];
    if (!grantSet) {
      throw new BadRequestException('AccessGrantSet not found');
    }

    if (
      grantSet.grantSubjectMode === AccessGrantSubjectMode.OWNER_DEVICE_SNAPSHOT &&
      !grantSet.snapshotDeviceIds.includes(trustedDeviceId)
    ) {
      throw new ForbiddenException('Trusted device is not eligible for this source item');
    }

    const attempt = await this.prisma.retrievalAttempt.upsert({
      where: {
        retrievalFamily_targetObjectId_requestingUserId_requestingDeviceId_attemptScopeKey: {
          retrievalFamily: RetrievalFamily.SOURCE_ITEM_OWNER,
          targetObjectId: sourceItemId,
          requestingUserId: userId,
          requestingDeviceId: trustedDeviceId,
          attemptScopeKey,
        },
      },
      update: {
        status: RetrievalAttemptStatus.IN_PROGRESS,
      },
      create: {
        retrievalFamily: RetrievalFamily.SOURCE_ITEM_OWNER,
        targetObjectType: ProtectedObjectType.SOURCE_ITEM,
        targetObjectId: sourceItemId,
        sourceItemId,
        requestingUserId: userId,
        requestingDeviceId: trustedDeviceId,
        status: RetrievalAttemptStatus.IN_PROGRESS,
        attemptScopeKey,
      },
      include: {
        packageReference: true,
      },
    });

    let packageReference = attempt.packageReference;

    if (!packageReference) {
      packageReference = await this.prisma.packageReference.create({
        data: {
          packageFamilyId: grantSet.ordinaryPackageFamilyId,
          packageFamilyKind: PackageFamilyKind.OWNER_ORDINARY,
          protectedObjectType: ProtectedObjectType.SOURCE_ITEM,
          protectedObjectId: sourceItemId,
          eligibleSubjectUserId: userId,
          eligibleSubjectDeviceId: trustedDeviceId,
          packageFamilyVersion: grantSet.ordinaryPackageFamily.familyVersion,
          wrappedPayloadReference:
            grantSet.ordinaryPackageFamily.referenceBlob as Prisma.InputJsonValue,
          expiresAt: new Date(Date.now() + 10 * 60_000),
          retrievalAttempt: {
            connect: { id: attempt.id },
          },
        },
      });
    }

    return {
      retrievalAttemptId: attempt.id,
      packageReferenceId: packageReference.id,
      packageFamilyKind: packageReference.packageFamilyKind,
      wrappedPayloadReference: packageReference.wrappedPayloadReference,
      storageBinding: sourceItem.storageBinding,
      textCiphertextBody: sourceItem.textCiphertextBody,
      contentKind: sourceItem.contentKind,
      expiresAt: packageReference.expiresAt,
    };
  }

  async completeSourceItemRetrieval(
    userId: string,
    trustedDeviceId: string | null,
    retrievalAttemptId: string,
    success: boolean,
  ) {
    if (!trustedDeviceId) {
      throw new ForbiddenException('Trusted device required');
    }

    const attempt = await this.prisma.retrievalAttempt.findUnique({
      where: { id: retrievalAttemptId },
      include: {
        sourceItem: true,
      },
    });

    if (
      !attempt ||
      attempt.requestingUserId !== userId ||
      attempt.requestingDeviceId !== trustedDeviceId ||
      attempt.retrievalFamily !== RetrievalFamily.SOURCE_ITEM_OWNER
    ) {
      throw new NotFoundException('Retrieval attempt not found');
    }

    if (attempt.status === RetrievalAttemptStatus.COMPLETED) {
      return {
        retrievalAttemptId: attempt.id,
        status: attempt.status,
        sourceItemState: attempt.sourceItem?.state ?? null,
      };
    }

    if (!success) {
      const failed = await this.prisma.retrievalAttempt.update({
        where: { id: attempt.id },
        data: { status: RetrievalAttemptStatus.FAILED },
      });

      return {
        retrievalAttemptId: failed.id,
        status: failed.status,
        sourceItemState: attempt.sourceItem?.state ?? null,
      };
    }

    const completed = await this.prisma.$transaction(async (tx) => {
      const updatedAttempt = await tx.retrievalAttempt.update({
        where: { id: attempt.id },
        data: {
          status: RetrievalAttemptStatus.COMPLETED,
          completedAt: new Date(),
        },
        include: { sourceItem: true },
      });

      if (updatedAttempt.sourceItem?.burnAfterReadEnabled) {
        await tx.sourceItem.update({
          where: { id: updatedAttempt.sourceItem.id },
          data: { state: SourceItemState.PURGED },
        });
      }

      return updatedAttempt;
    });

    if (completed.sourceItemId) {
      await this.projectionService.projectSourceItem(completed.sourceItemId);
    }

    return {
      retrievalAttemptId: completed.id,
      status: completed.status,
      sourceItemState: completed.sourceItem?.burnAfterReadEnabled
        ? SourceItemState.PURGED
        : completed.sourceItem?.state ?? null,
    };
  }
}
