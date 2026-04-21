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
  SourceItemState,
  type User,
  UploadContentKind,
  UploadSessionPhase,
} from '../../generated/prisma/index.js';
import { PrismaService } from '../prisma/prisma.service';
import { PolicyService } from '../policy/policy.service';
import { PrepareUploadDto } from './dto/prepare-upload.dto';
import { RegisterUploadPartDto } from './dto/register-upload-part.dto';
import { FinalizeUploadDto } from './dto/finalize-upload.dto';

@Injectable()
export class UploadsService {
  private readonly uploadSessionTtlMs = 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
  ) {}

  async prepareUpload(userId: string, input: PrepareUploadDto) {
    await this.requireEligibleTrustedUploader(userId);

    const confidentialityLevel =
      input.confidentialityLevel ?? this.policyService.getDefaultConfidentialityLevel();

    this.validateContentShape(input);

    const decision = await this.policyService.evaluateSourceCreation({
      confidentialityLevel,
      requestedValidityMinutes: input.requestedValidityMinutes ?? null,
      burnAfterReadEnabled: input.burnAfterReadEnabled ?? false,
      contentKind: input.contentKind,
    });

    const uploadSession = await this.prisma.uploadSession.create({
      data: {
        uploaderUserId: userId,
        contentKind: input.contentKind,
        groupStructureKind: input.groupStructureKind,
        confidentialityLevel,
        policyBundleId: decision.policyBundle.id,
        policySnapshot: decision.snapshotFieldsToPersist as Prisma.InputJsonValue,
        requestedValidityMinutes: input.requestedValidityMinutes ?? null,
        resolvedValidityMinutes: decision.resolvedValidityMinutes,
        burnAfterReadEnabled: input.burnAfterReadEnabled ?? false,
        phase: UploadSessionPhase.UPLOADING,
        expiresAt: new Date(Date.now() + this.uploadSessionTtlMs),
      },
    });

    return {
      uploadSessionId: uploadSession.id,
      contentKind: uploadSession.contentKind,
      confidentialityLevel: uploadSession.confidentialityLevel,
      resolvedValidityMinutes: uploadSession.resolvedValidityMinutes,
      expiresAt: uploadSession.expiresAt,
      policySnapshot: uploadSession.policySnapshot,
    };
  }

  async registerUploadPart(userId: string, uploadSessionId: string, input: RegisterUploadPartDto) {
    const session = await this.requireOwnedActiveUploadSession(userId, uploadSessionId);

    if (session.contentKind === UploadContentKind.SELF_SPACE_TEXT) {
      throw new BadRequestException('Text uploads do not accept file parts');
    }

    await this.prisma.uploadPart.upsert({
      where: {
        uploadSessionId_partNumber: {
          uploadSessionId,
          partNumber: input.partNumber,
        },
      },
      update: {
        storageKey: input.storageKey,
        byteSize: input.byteSize,
        checksum: input.checksum,
      },
      create: {
        uploadSessionId,
        partNumber: input.partNumber,
        storageKey: input.storageKey,
        byteSize: input.byteSize,
        checksum: input.checksum,
      },
    });

    await this.prisma.uploadSession.update({
      where: { id: uploadSessionId },
      data: { phase: UploadSessionPhase.UPLOADING },
    });

    return { ok: true };
  }

  async finalizeUpload(userId: string, uploadSessionId: string, input: FinalizeUploadDto) {
    const session = await this.requireOwnedActiveUploadSession(userId, uploadSessionId);
    const policySnapshot = session.policySnapshot as Record<string, unknown>;

    if (session.contentKind === UploadContentKind.SELF_SPACE_TEXT) {
      if (!input.textCiphertextBody) {
        throw new BadRequestException('Text source items require ciphertext body at finalization');
      }
    } else {
      const partCount = await this.prisma.uploadPart.count({ where: { uploadSessionId } });
      if (partCount === 0) {
        throw new BadRequestException('At least one upload part is required before finalization');
      }
    }

    if (session.contentKind === UploadContentKind.GROUPED_CONTENT && !input.manifest) {
      throw new BadRequestException('Grouped content requires a manifest at finalization');
    }

    const sourceItem = await this.prisma.$transaction(async (tx) => {
      const partCount = await tx.uploadPart.count({ where: { uploadSessionId } });
      const storageBinding =
        session.contentKind === UploadContentKind.SELF_SPACE_TEXT
          ? Prisma.JsonNull
          : ({
              uploadSessionId,
              partCount,
            } as Prisma.InputJsonValue);

      const created = await tx.sourceItem.create({
        data: {
          ownerUserId: userId,
          contentKind: session.contentKind,
          groupStructureKind: session.groupStructureKind,
          confidentialityLevel: session.confidentialityLevel,
          state: SourceItemState.ACTIVE,
          policyBundleId: session.policyBundleId,
          policySnapshot: session.policySnapshot as Prisma.InputJsonValue,
          displayName: input.displayName ?? null,
          textCiphertextBody: input.textCiphertextBody ?? null,
          storageBinding,
          validUntil:
            session.resolvedValidityMinutes && session.resolvedValidityMinutes > 0
              ? new Date(Date.now() + session.resolvedValidityMinutes * 60_000)
              : null,
          burnAfterReadEnabled: session.burnAfterReadEnabled,
        },
      });

      if (session.contentKind === UploadContentKind.GROUPED_CONTENT && input.manifest) {
        await tx.groupManifest.create({
          data: {
            sourceItemId: created.id,
            structureKind: session.groupStructureKind ?? 'MULTI_FILE',
            manifestJson: input.manifest as Prisma.InputJsonValue,
          },
        });
      }

      const ordinaryPackageFamily = await tx.packageFamily.create({
        data: {
          protectedObjectType: ProtectedObjectType.SOURCE_ITEM,
          protectedObjectId: created.id,
          sourceItemId: created.id,
          kind: PackageFamilyKind.OWNER_ORDINARY,
          familyVersion: 1,
          issueTrigger: 'source_created',
          referenceBlob: {
            packageFamily: 'owner_ordinary',
            sourceItemId: created.id,
            contentKind: created.contentKind,
          },
        },
      });

      const recoveryPackageFamily = await tx.packageFamily.create({
        data: {
          protectedObjectType: ProtectedObjectType.SOURCE_ITEM,
          protectedObjectId: created.id,
          sourceItemId: created.id,
          kind: PackageFamilyKind.OWNER_RECOVERY,
          familyVersion: 1,
          issueTrigger: 'source_created',
          referenceBlob: {
            packageFamily: 'owner_recovery',
            sourceItemId: created.id,
          },
        },
      });

      await tx.accessGrantSet.create({
        data: {
          version: 1,
          protectedObjectType: ProtectedObjectType.SOURCE_ITEM,
          sourceItemId: created.id,
          status: AccessGrantStatus.CURRENT,
          grantSubjectMode: Boolean(policySnapshot.allowFutureTrustedDevices)
            ? AccessGrantSubjectMode.OWNER_DOMAIN
            : AccessGrantSubjectMode.OWNER_DEVICE_SNAPSHOT,
          subjectUserId: userId,
          snapshotDeviceIds: Boolean(policySnapshot.allowFutureTrustedDevices)
            ? []
            : (await tx.trustedDevice.findMany({
                where: { userId, trustState: 'TRUSTED' },
                orderBy: { createdAt: 'asc' },
                select: { id: true },
              })).map((device) => device.id),
          ordinaryPackageFamilyId: ordinaryPackageFamily.id,
          recoveryEnabled: true,
          recoveryPackageFamilyId: recoveryPackageFamily.id,
          confidentialityLevel: session.confidentialityLevel,
          allowFutureTrustedDevices: Boolean(policySnapshot.allowFutureTrustedDevices),
          allowRecipientMultiDeviceAccess: false,
          issueTrigger: 'source_created',
        },
      });

      await tx.uploadSession.update({
        where: { id: uploadSessionId },
        data: {
          phase: UploadSessionPhase.COMPLETED,
          finalizedSourceItemId: created.id,
        },
      });

      return created;
    });

    return {
      sourceItemId: sourceItem.id,
      contentKind: sourceItem.contentKind,
      state: sourceItem.state,
      validUntil: sourceItem.validUntil,
    };
  }

  private validateContentShape(input: PrepareUploadDto) {
    if (input.contentKind === UploadContentKind.GROUPED_CONTENT && !input.groupStructureKind) {
      throw new BadRequestException('Grouped content requires a group structure kind');
    }

    if (input.contentKind !== UploadContentKind.GROUPED_CONTENT && input.groupStructureKind) {
      throw new BadRequestException('Group structure kind is only valid for grouped content');
    }
  }

  private async requireOwnedActiveUploadSession(userId: string, uploadSessionId: string) {
    const session = await this.prisma.uploadSession.findUnique({
      where: { id: uploadSessionId },
    });

    if (!session || session.uploaderUserId !== userId) {
      throw new NotFoundException('Upload session not found');
    }

    if (session.expiresAt < new Date()) {
      await this.prisma.uploadSession.update({
        where: { id: session.id },
        data: { phase: UploadSessionPhase.EXPIRED },
      });

      throw new BadRequestException('Upload session expired');
    }

    if (session.phase === UploadSessionPhase.COMPLETED) {
      throw new BadRequestException('Upload session already completed');
    }

    return session;
  }

  private async requireEligibleTrustedUploader(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.enablementState === 'DISABLED') {
      throw new ForbiddenException('User cannot create source items');
    }

    if (user.admissionState !== 'APPROVED') {
      throw new ForbiddenException('Pending users cannot create source items');
    }

    const trustedDevice = await this.prisma.trustedDevice.findFirst({
      where: {
        userId,
        trustState: 'TRUSTED',
      },
      orderBy: { trustEstablishedAt: 'asc' },
    });

    if (!trustedDevice) {
      throw new ForbiddenException('Trusted device required for source creation');
    }

    return user;
  }
}
