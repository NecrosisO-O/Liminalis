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
  ShareObjectState,
  SourceItemState,
} from '../../generated/prisma/index.js';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectionService } from '../projections/projection.service';
import { StorageService } from '../storage/storage.service';
import { Readable } from 'stream';

@Injectable()
export class RetrievalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectionService: ProjectionService,
    private readonly storageService: StorageService,
  ) {}

  async getAttempt(retrievalAttemptId: string) {
    const attempt = await this.prisma.retrievalAttempt.findUnique({
      where: { id: retrievalAttemptId },
    });

    if (!attempt) {
      throw new NotFoundException('Retrieval attempt not found');
    }

    return attempt;
  }

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
            recoveryPackageFamily: true,
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

    const packageSelection = await this.selectOwnerPackageFamily(userId, trustedDeviceId, grantSet);

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
          packageFamilyId: packageSelection.packageFamily.id,
          packageFamilyKind: packageSelection.kind,
          protectedObjectType: ProtectedObjectType.SOURCE_ITEM,
          protectedObjectId: sourceItemId,
          eligibleSubjectUserId: userId,
          eligibleSubjectDeviceId: trustedDeviceId,
          packageFamilyVersion: packageSelection.packageFamily.familyVersion,
          wrappedPayloadReference:
            packageSelection.packageFamily.referenceBlob as Prisma.InputJsonValue,
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

  async createDownloadStreamForAttempt(
    userId: string,
    trustedDeviceId: string | null,
    retrievalAttemptId: string,
  ) {
    if (!trustedDeviceId) {
      throw new ForbiddenException('Trusted device required');
    }

    const attempt = await this.prisma.retrievalAttempt.findUnique({
      where: { id: retrievalAttemptId },
      include: {
        sourceItem: true,
        shareObject: {
          include: { sourceItem: true },
        },
      },
    });

    if (
      !attempt ||
      attempt.requestingUserId !== userId ||
      attempt.requestingDeviceId !== trustedDeviceId ||
      (attempt.retrievalFamily !== RetrievalFamily.SOURCE_ITEM_OWNER &&
        attempt.retrievalFamily !== RetrievalFamily.SHARE_OBJECT_RECIPIENT)
    ) {
      throw new NotFoundException('Retrieval attempt not found');
    }

    if (
      attempt.status !== RetrievalAttemptStatus.IN_PROGRESS &&
      attempt.status !== RetrievalAttemptStatus.ISSUED
    ) {
      throw new BadRequestException('Retrieval attempt is not downloadable');
    }

    if (attempt.shareObject && attempt.shareObject.state !== ShareObjectState.ACTIVE) {
      throw new BadRequestException('Share object is not retrievable');
    }

    const sourceItem = attempt.sourceItem ?? attempt.shareObject?.sourceItem ?? null;
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
      await this.projectionService.projectSourceItem(sourceItem.id);
      throw new BadRequestException('Source item expired');
    }

    const parts = this.extractStorageParts(sourceItem.storageBinding);
    const contentLength = parts.reduce((sum, part) => sum + part.byteSize, 0);
    const stream = Readable.from(this.readParts(parts.map((part) => part.storageKey)));

    return {
      stream,
      contentLength,
      fileName: sourceItem.displayName ?? 'liminalis-download.bin',
    };
  }

  private extractStorageParts(storageBinding: unknown) {
    if (!storageBinding || typeof storageBinding !== 'object' || !('parts' in storageBinding)) {
      throw new BadRequestException('Source item has no stored file bytes');
    }

    const parts = (storageBinding as { parts?: unknown }).parts;
    if (!Array.isArray(parts) || parts.length === 0) {
      throw new BadRequestException('Source item has no stored file bytes');
    }

    return parts.map((part) => {
      if (
        !part ||
        typeof part !== 'object' ||
        typeof (part as { storageKey?: unknown }).storageKey !== 'string' ||
        typeof (part as { byteSize?: unknown }).byteSize !== 'number'
      ) {
        throw new BadRequestException('Stored file binding is invalid');
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

  private async selectOwnerPackageFamily(
    userId: string,
    trustedDeviceId: string,
    grantSet: {
      grantSubjectMode: AccessGrantSubjectMode;
      snapshotDeviceIds: string[];
      recoveryEnabled: boolean;
      ordinaryPackageFamily: {
        id: string;
        familyVersion: number;
        referenceBlob: unknown;
      };
      recoveryPackageFamily: {
        id: string;
        familyVersion: number;
        referenceBlob: unknown;
      } | null;
    },
  ) {
    const ordinaryEligible =
      grantSet.grantSubjectMode !== AccessGrantSubjectMode.OWNER_DEVICE_SNAPSHOT ||
      grantSet.snapshotDeviceIds.includes(trustedDeviceId);

    if (ordinaryEligible) {
      return {
        kind: PackageFamilyKind.OWNER_ORDINARY,
        packageFamily: grantSet.ordinaryPackageFamily,
      };
    }

    const trustedDevice = await this.prisma.trustedDevice.findFirst({
      where: {
        id: trustedDeviceId,
        userId,
        trustState: 'TRUSTED',
      },
      select: { recoveryEstablishedAt: true },
    });

    if (
      grantSet.recoveryEnabled &&
      grantSet.recoveryPackageFamily &&
      trustedDevice?.recoveryEstablishedAt
    ) {
      return {
        kind: PackageFamilyKind.OWNER_RECOVERY,
        packageFamily: grantSet.recoveryPackageFamily,
      };
    }

    throw new ForbiddenException('Trusted device is not eligible for this source item');
  }
}
