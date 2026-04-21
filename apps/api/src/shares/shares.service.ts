import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/index.js';
import {
  AccessGrantSubjectMode,
  AccessGrantStatus,
  PackageFamilyKind,
  ProtectedObjectType,
  RetrievalAttemptStatus,
  RetrievalFamily,
  ShareObjectInactiveReason,
  ShareObjectState,
  type SourceItem,
} from '../../generated/prisma/index.js';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectionService } from '../projections/projection.service';
import { PolicyService } from '../policy/policy.service';
import { CreateShareDto } from './dto/create-share.dto';

@Injectable()
export class SharesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
    private readonly projectionService: ProjectionService,
  ) {}

  async createUserTargetedShare(ownerUserId: string, input: CreateShareDto) {
    const sourceItem = await this.prisma.sourceItem.findFirst({
      where: {
        id: input.sourceItemId,
        ownerUserId,
        state: 'ACTIVE',
      },
      include: {
        ownerUser: true,
      },
    });

    if (!sourceItem) {
      throw new NotFoundException('Source item not found');
    }

    const recipient = await this.prisma.user.findUnique({
      where: { username: input.recipientUsername },
      include: {
        wrappingKeys: { where: { isCurrent: true } },
        devices: { where: { trustState: 'TRUSTED' } },
      },
    });

    if (!recipient || recipient.admissionState !== 'APPROVED' || recipient.enablementState !== 'ENABLED') {
      throw new BadRequestException('Recipient is not eligible for identity-bound protected sharing');
    }

    if (recipient.wrappingKeys.length === 0) {
      throw new BadRequestException('Recipient has not published trusted-device wrapping material');
    }

    const decision = await this.policyService.evaluateShareCreation({
      confidentialityLevel: sourceItem.confidentialityLevel,
      requestedValidityMinutes: input.requestedValidityMinutes ?? null,
    });

    const share = await this.prisma.$transaction(async (tx) => {
      const created = await tx.shareObject.create({
        data: {
          sourceItemId: sourceItem.id,
          ownerUserId,
          recipientUserId: recipient.id,
          confidentialityLevel: sourceItem.confidentialityLevel,
          policyBundleId: decision.policyBundle.id,
          policySnapshot: decision.snapshotFieldsToPersist,
          validUntil: decision.resolvedValidityMinutes
            ? new Date(Date.now() + decision.resolvedValidityMinutes * 60_000)
            : null,
          allowRepeatDownload: decision.allowRepeatDownload,
          allowRecipientMultiDeviceAccess: decision.allowRecipientMultiDeviceAccess,
          burnAfterReadEnabled: sourceItem.burnAfterReadEnabled,
        },
      });

      const ordinaryPackageFamily = await tx.packageFamily.create({
        data: {
          protectedObjectType: ProtectedObjectType.SHARE_OBJECT,
          protectedObjectId: created.id,
          shareObjectId: created.id,
          kind: PackageFamilyKind.RECIPIENT_ORDINARY,
          familyVersion: 1,
          issueTrigger: 'share_created',
          referenceBlob: {
            packageFamily: 'recipient_ordinary',
            shareObjectId: created.id,
            sourceItemId: sourceItem.id,
            recipientUserId: recipient.id,
          },
        },
      });

      const recoveryPackageFamily = await tx.packageFamily.create({
        data: {
          protectedObjectType: ProtectedObjectType.SHARE_OBJECT,
          protectedObjectId: created.id,
          shareObjectId: created.id,
          kind: PackageFamilyKind.RECIPIENT_RECOVERY,
          familyVersion: 1,
          issueTrigger: 'share_created',
          referenceBlob: {
            packageFamily: 'recipient_recovery',
            shareObjectId: created.id,
            recipientUserId: recipient.id,
          },
        },
      });

      await tx.accessGrantSet.create({
        data: {
          version: 1,
          protectedObjectType: ProtectedObjectType.SHARE_OBJECT,
          shareObjectId: created.id,
          status: AccessGrantStatus.CURRENT,
          grantSubjectMode: decision.allowRecipientMultiDeviceAccess
            ? AccessGrantSubjectMode.RECIPIENT_DOMAIN
            : AccessGrantSubjectMode.RECIPIENT_DEVICE_SNAPSHOT,
          subjectUserId: recipient.id,
          snapshotDeviceIds: decision.allowRecipientMultiDeviceAccess
            ? []
            : recipient.devices.map((device) => device.id),
          ordinaryPackageFamilyId: ordinaryPackageFamily.id,
          recoveryEnabled: true,
          recoveryPackageFamilyId: recoveryPackageFamily.id,
          confidentialityLevel: sourceItem.confidentialityLevel,
          allowFutureTrustedDevices: false,
          allowRecipientMultiDeviceAccess: decision.allowRecipientMultiDeviceAccess,
          issueTrigger: 'share_created',
        },
      });

      return created;
    });

    await this.projectionService.projectShareObject(share.id);

    return {
      shareObjectId: share.id,
      recipientUserId: share.recipientUserId,
      allowRepeatDownload: share.allowRepeatDownload,
      allowRecipientMultiDeviceAccess: share.allowRecipientMultiDeviceAccess,
      validUntil: share.validUntil,
    };
  }

  async issueRecipientRetrieval(
    userId: string,
    trustedDeviceId: string | null,
    shareObjectId: string,
    attemptScopeKey: string,
  ) {
    if (!trustedDeviceId) {
      throw new ForbiddenException('Trusted device required');
    }

    const share = await this.prisma.shareObject.findFirst({
      where: {
        id: shareObjectId,
        recipientUserId: userId,
      },
      include: {
        sourceItem: true,
        accessGrantSets: {
          where: { status: 'CURRENT' },
          include: { ordinaryPackageFamily: true },
        },
      },
    });

    if (!share) {
      throw new NotFoundException('Share object not found');
    }

    if (share.state !== ShareObjectState.ACTIVE) {
      throw new BadRequestException('Share object is not retrievable');
    }

    if (share.validUntil && share.validUntil < new Date()) {
      await this.prisma.shareObject.update({
        where: { id: share.id },
        data: {
          state: ShareObjectState.INACTIVE,
          inactiveReason: ShareObjectInactiveReason.EXPIRED,
        },
      });
      await this.projectionService.projectShareObject(share.id);
      throw new BadRequestException('Share object expired');
    }

    const grantSet = share.accessGrantSets[0];
    if (!grantSet) {
      throw new BadRequestException('AccessGrantSet not found');
    }

    if (
      grantSet.grantSubjectMode === AccessGrantSubjectMode.RECIPIENT_DEVICE_SNAPSHOT &&
      !grantSet.snapshotDeviceIds.includes(trustedDeviceId)
    ) {
      throw new ForbiddenException('Trusted device is not eligible for this share');
    }

    const attempt = await this.prisma.retrievalAttempt.upsert({
      where: {
        retrievalFamily_targetObjectId_requestingUserId_requestingDeviceId_attemptScopeKey: {
          retrievalFamily: RetrievalFamily.SHARE_OBJECT_RECIPIENT,
          targetObjectId: shareObjectId,
          requestingUserId: userId,
          requestingDeviceId: trustedDeviceId,
          attemptScopeKey,
        },
      },
      update: {
        status: RetrievalAttemptStatus.IN_PROGRESS,
      },
      create: {
        retrievalFamily: RetrievalFamily.SHARE_OBJECT_RECIPIENT,
        targetObjectType: ProtectedObjectType.SHARE_OBJECT,
        targetObjectId: shareObjectId,
        shareObjectId,
        requestingUserId: userId,
        requestingDeviceId: trustedDeviceId,
        status: RetrievalAttemptStatus.IN_PROGRESS,
        attemptScopeKey,
      },
      include: { packageReference: true },
    });

    let packageReference = attempt.packageReference;

    if (!packageReference) {
      packageReference = await this.prisma.packageReference.create({
        data: {
          packageFamilyId: grantSet.ordinaryPackageFamilyId,
          packageFamilyKind: PackageFamilyKind.RECIPIENT_ORDINARY,
          protectedObjectType: ProtectedObjectType.SHARE_OBJECT,
          protectedObjectId: shareObjectId,
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
      sourceItemId: share.sourceItemId,
      textCiphertextBody: share.sourceItem.textCiphertextBody,
      contentKind: share.sourceItem.contentKind,
      expiresAt: packageReference.expiresAt,
    };
  }

  async completeRecipientRetrieval(
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
      include: { shareObject: true },
    });

    if (
      !attempt ||
      attempt.requestingUserId !== userId ||
      attempt.requestingDeviceId !== trustedDeviceId ||
      attempt.retrievalFamily !== RetrievalFamily.SHARE_OBJECT_RECIPIENT
    ) {
      throw new NotFoundException('Retrieval attempt not found');
    }

    if (attempt.status === RetrievalAttemptStatus.COMPLETED) {
      return {
        retrievalAttemptId: attempt.id,
        status: attempt.status,
        shareState: attempt.shareObject?.state ?? null,
        inactiveReason: attempt.shareObject?.inactiveReason ?? null,
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
        shareState: attempt.shareObject?.state ?? null,
        inactiveReason: attempt.shareObject?.inactiveReason ?? null,
      };
    }

    const completed = await this.prisma.$transaction(async (tx) => {
      const updatedAttempt = await tx.retrievalAttempt.update({
        where: { id: attempt.id },
        data: {
          status: RetrievalAttemptStatus.COMPLETED,
          completedAt: new Date(),
        },
        include: { shareObject: true },
      });

      if (updatedAttempt.shareObject && !updatedAttempt.shareObject.allowRepeatDownload) {
        await tx.shareObject.update({
          where: { id: updatedAttempt.shareObject.id },
          data: {
            state: ShareObjectState.INACTIVE,
            inactiveReason: ShareObjectInactiveReason.CONSUMED,
          },
        });
      }

      return updatedAttempt;
    });

    if (completed.shareObjectId) {
      await this.projectionService.projectShareObject(completed.shareObjectId);
    }

    const refreshedShare = completed.shareObjectId
      ? await this.prisma.shareObject.findUnique({ where: { id: completed.shareObjectId } })
      : null;

    return {
      retrievalAttemptId: completed.id,
      status: completed.status,
      shareState: refreshedShare?.state ?? completed.shareObject?.state ?? null,
      inactiveReason: refreshedShare?.inactiveReason ?? completed.shareObject?.inactiveReason ?? null,
    };
  }

  async getIncomingShares(userId: string) {
    return this.prisma.shareObject.findMany({
      where: { recipientUserId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
