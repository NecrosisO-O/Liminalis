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
  UploadContentKind,
  UploadSessionPhase,
} from '../../generated/prisma/index.js';
import type { Readable } from 'stream';
import {
  DEFAULT_STORAGE_QUOTA_BYTES,
  bytesToJsonNumber,
  inputBytesToBigInt,
  partsForJson,
  sumBytes,
} from '../common/utils/byte-values';
import { PrismaService } from '../prisma/prisma.service';
import { PolicyService } from '../policy/policy.service';
import { ProjectionService } from '../projections/projection.service';
import { StorageService } from '../storage/storage.service';
import { PrepareUploadDto } from './dto/prepare-upload.dto';
import { RegisterUploadPartDto } from './dto/register-upload-part.dto';
import { FinalizeUploadDto } from './dto/finalize-upload.dto';

@Injectable()
export class UploadsService {
  private readonly uploadSessionTtlMs = 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
    private readonly projectionService: ProjectionService,
    private readonly storageService: StorageService,
  ) {}

  async prepareUpload(
    userId: string,
    trustedDeviceId: string | null,
    input: PrepareUploadDto,
  ) {
    await this.requireEligibleTrustedUploader(userId);

    const confidentialityLevel =
      input.confidentialityLevel ??
      (await this.policyService.getDefaultConfidentialityLevel());

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
        uploaderTrustedDeviceId: trustedDeviceId,
        contentKind: input.contentKind,
        groupStructureKind: input.groupStructureKind,
        confidentialityLevel,
        policyBundleId: decision.policyBundle.id,
        policySnapshot: decision.snapshotFieldsToPersist,
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

  async registerUploadPart(
    userId: string,
    uploadSessionId: string,
    input: RegisterUploadPartDto,
  ) {
    const session = await this.requireOwnedActiveUploadSession(
      userId,
      uploadSessionId,
    );

    if (session.contentKind === UploadContentKind.SELF_SPACE_TEXT) {
      throw new BadRequestException('Text uploads do not accept file parts');
    }

    if (!input.storageKey.startsWith(`uploads/${userId}/${uploadSessionId}/`)) {
      throw new BadRequestException(
        'Upload part storage key does not belong to this session',
      );
    }

    await this.storageService.requireExistingObject(
      input.storageKey,
      input.byteSize,
    );
    await this.requireStorageQuotaForPart(
      userId,
      uploadSessionId,
      input.partNumber,
      input.byteSize,
    );

    const byteSize = inputBytesToBigInt(input.byteSize);

    await this.prisma.uploadPart.upsert({
      where: {
        uploadSessionId_partNumber: {
          uploadSessionId,
          partNumber: input.partNumber,
        },
      },
      update: {
        storageKey: input.storageKey,
        byteSize,
        checksum: input.checksum,
      },
      create: {
        uploadSessionId,
        partNumber: input.partNumber,
        storageKey: input.storageKey,
        byteSize,
        checksum: input.checksum,
      },
    });

    await this.prisma.uploadSession.update({
      where: { id: uploadSessionId },
      data: { phase: UploadSessionPhase.UPLOADING },
    });

    return { ok: true };
  }

  async storeUploadPartBody(
    userId: string,
    uploadSessionId: string,
    partNumber: number,
    body: Readable,
  ) {
    if (partNumber < 1 || !Number.isInteger(partNumber)) {
      throw new BadRequestException('Part number must be a positive integer');
    }

    const session = await this.requireOwnedActiveUploadSession(
      userId,
      uploadSessionId,
    );

    if (session.contentKind === UploadContentKind.SELF_SPACE_TEXT) {
      throw new BadRequestException('Text uploads do not accept file parts');
    }

    const stored = await this.storageService.writeUploadPart({
      userId,
      uploadSessionId,
      partNumber,
      body,
    });

    const previousPart = await this.prisma.uploadPart.findUnique({
      where: {
        uploadSessionId_partNumber: {
          uploadSessionId,
          partNumber,
        },
      },
      select: { storageKey: true },
    });

    try {
      await this.requireStorageQuotaForPart(
        userId,
        uploadSessionId,
        partNumber,
        stored.byteSize,
      );
    } catch (error) {
      await this.storageService.remove(stored.storageKey);
      throw error;
    }

    const storedByteSize = inputBytesToBigInt(stored.byteSize);
    const part = await this.prisma.uploadPart.upsert({
      where: {
        uploadSessionId_partNumber: {
          uploadSessionId,
          partNumber,
        },
      },
      update: {
        storageKey: stored.storageKey,
        byteSize: storedByteSize,
        checksum: stored.checksum,
      },
      create: {
        uploadSessionId,
        partNumber,
        storageKey: stored.storageKey,
        byteSize: storedByteSize,
        checksum: stored.checksum,
      },
    });

    if (previousPart && previousPart.storageKey !== stored.storageKey) {
      await this.storageService.remove(previousPart.storageKey);
    }

    await this.prisma.uploadSession.update({
      where: { id: uploadSessionId },
      data: { phase: UploadSessionPhase.UPLOADING },
    });

    return {
      uploadPartId: part.id,
      partNumber: part.partNumber,
      storageKey: part.storageKey,
      byteSize: bytesToJsonNumber(part.byteSize),
      checksum: part.checksum,
    };
  }

  async finalizeUpload(
    userId: string,
    trustedDeviceId: string | null,
    uploadSessionId: string,
    input: FinalizeUploadDto,
  ) {
    const session = await this.requireOwnedActiveUploadSession(
      userId,
      uploadSessionId,
    );
    const policySnapshot = session.policySnapshot as Record<string, unknown>;

    if (session.contentKind === UploadContentKind.SELF_SPACE_TEXT) {
      if (!input.textCiphertextBody) {
        throw new BadRequestException(
          'Text source items require ciphertext body at finalization',
        );
      }
    } else {
      const partCount = await this.prisma.uploadPart.count({
        where: { uploadSessionId },
      });
      if (partCount === 0) {
        throw new BadRequestException(
          'At least one upload part is required before finalization',
        );
      }
    }

    if (
      session.contentKind === UploadContentKind.GROUPED_CONTENT &&
      !input.manifest &&
      !input.encryptedMetadata
    ) {
      throw new BadRequestException(
        'Grouped content requires encrypted metadata at finalization',
      );
    }

    const sourceItem = await this.prisma.$transaction(async (tx) => {
      const partCount = await tx.uploadPart.count({
        where: { uploadSessionId },
      });
      const parts = await tx.uploadPart.findMany({
        where: { uploadSessionId },
        orderBy: { partNumber: 'asc' },
        select: {
          partNumber: true,
          storageKey: true,
          byteSize: true,
          checksum: true,
        },
      });
      const storageBytes = sumBytes(parts.map((part) => part.byteSize));
      const cryptoMetadata = input.contentCryptoMetadata
        ? (input.contentCryptoMetadata as Prisma.InputJsonValue)
        : Prisma.JsonNull;
      const encryptedMetadata = input.encryptedMetadata
        ? (input.encryptedMetadata as Prisma.InputJsonValue)
        : Prisma.JsonNull;
      const storageBinding =
        session.contentKind === UploadContentKind.SELF_SPACE_TEXT
          ? Prisma.JsonNull
          : ({
              uploadSessionId,
              partCount,
              parts: partsForJson(parts),
              crypto: input.contentCryptoMetadata ?? null,
            } as Prisma.InputJsonValue);
      const genericDisplayName = this.genericDisplayName(session.contentKind);

      const created = await tx.sourceItem.create({
        data: {
          ownerUserId: userId,
          createdByTrustedDeviceId:
            session.uploaderTrustedDeviceId ?? trustedDeviceId,
          contentKind: session.contentKind,
          groupStructureKind: session.groupStructureKind,
          confidentialityLevel: session.confidentialityLevel,
          state: SourceItemState.ACTIVE,
          policyBundleId: session.policyBundleId,
          policySnapshot: session.policySnapshot as Prisma.InputJsonValue,
          displayName: input.cryptoVersion
            ? genericDisplayName
            : (input.displayName ?? null),
          textCiphertextBody: input.textCiphertextBody ?? null,
          cryptoVersion: input.cryptoVersion ?? null,
          encryptedMetadata,
          contentCryptoMetadata: cryptoMetadata,
          storageBinding,
          storageBytes,
          validUntil:
            session.resolvedValidityMinutes &&
            session.resolvedValidityMinutes > 0
              ? new Date(Date.now() + session.resolvedValidityMinutes * 60_000)
              : null,
          burnAfterReadEnabled: session.burnAfterReadEnabled,
        },
      });

      if (
        session.contentKind === UploadContentKind.GROUPED_CONTENT &&
        (input.manifest || input.encryptedMetadata)
      ) {
        await tx.groupManifest.create({
          data: {
            sourceItemId: created.id,
            structureKind: session.groupStructureKind ?? 'MULTI_FILE',
            manifestJson: (input.manifest ?? {
              encryptedManifest: true,
              metadataEnvelope: input.encryptedMetadata ?? null,
            }) as Prisma.InputJsonValue,
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
          referenceBlob: (input.ownerKeyEnvelope ?? {
            packageFamily: 'legacy_owner_ordinary',
            sourceItemId: created.id,
            contentKind: created.contentKind,
            encryptedMetadata: input.encryptedMetadata ?? null,
            contentCryptoMetadata: input.contentCryptoMetadata ?? null,
          }) as Prisma.InputJsonValue,
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
          referenceBlob: (input.ownerKeyEnvelope ?? {
            packageFamily: 'legacy_owner_recovery',
            sourceItemId: created.id,
            encryptedMetadata: input.encryptedMetadata ?? null,
            contentCryptoMetadata: input.contentCryptoMetadata ?? null,
          }) as Prisma.InputJsonValue,
        },
      });

      await tx.accessGrantSet.create({
        data: {
          version: 1,
          protectedObjectType: ProtectedObjectType.SOURCE_ITEM,
          sourceItemId: created.id,
          status: AccessGrantStatus.CURRENT,
          grantSubjectMode: policySnapshot.allowFutureTrustedDevices
            ? AccessGrantSubjectMode.OWNER_DOMAIN
            : AccessGrantSubjectMode.OWNER_DEVICE_SNAPSHOT,
          subjectUserId: userId,
          snapshotDeviceIds: policySnapshot.allowFutureTrustedDevices
            ? []
            : (
                await tx.trustedDevice.findMany({
                  where: { userId, trustState: 'TRUSTED' },
                  orderBy: { createdAt: 'asc' },
                  select: { id: true },
                })
              ).map((device) => device.id),
          ordinaryPackageFamilyId: ordinaryPackageFamily.id,
          recoveryEnabled: true,
          recoveryPackageFamilyId: recoveryPackageFamily.id,
          confidentialityLevel: session.confidentialityLevel,
          allowFutureTrustedDevices: Boolean(
            policySnapshot.allowFutureTrustedDevices,
          ),
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

    await this.projectionService.projectSourceItem(sourceItem.id);

    return {
      sourceItemId: sourceItem.id,
      contentKind: sourceItem.contentKind,
      state: sourceItem.state,
      validUntil: sourceItem.validUntil,
    };
  }

  private validateContentShape(input: PrepareUploadDto) {
    if (
      input.contentKind === UploadContentKind.GROUPED_CONTENT &&
      !input.groupStructureKind
    ) {
      throw new BadRequestException(
        'Grouped content requires a group structure kind',
      );
    }

    if (
      input.contentKind !== UploadContentKind.GROUPED_CONTENT &&
      input.groupStructureKind
    ) {
      throw new BadRequestException(
        'Group structure kind is only valid for grouped content',
      );
    }
  }

  private genericDisplayName(contentKind: UploadContentKind) {
    if (contentKind === UploadContentKind.SELF_SPACE_TEXT) {
      return 'Encrypted text';
    }

    if (contentKind === UploadContentKind.GROUPED_CONTENT) {
      return 'Grouped encrypted content';
    }

    return 'Encrypted file';
  }

  private async requireOwnedActiveUploadSession(
    userId: string,
    uploadSessionId: string,
  ) {
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
      throw new ForbiddenException(
        'Trusted device required for source creation',
      );
    }

    return user;
  }

  private async requireStorageQuotaForPart(
    userId: string,
    uploadSessionId: string,
    partNumber: number,
    incomingByteSize: number,
  ) {
    const [usage, existingPart, user, settings] = await Promise.all([
      this.prisma.uploadPart.aggregate({
        where: {
          uploadSession: {
            uploaderUserId: userId,
          },
        },
        _sum: { byteSize: true },
      }),
      this.prisma.uploadPart.findUnique({
        where: {
          uploadSessionId_partNumber: {
            uploadSessionId,
            partNumber,
          },
        },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { storageQuotaBytes: true },
      }),
      this.prisma.instanceSetting.findUnique({
        where: { singletonKey: 'default' },
        select: { defaultStorageQuotaBytes: true },
      }),
    ]);

    const quotaBytes =
      user?.storageQuotaBytes ??
      settings?.defaultStorageQuotaBytes ??
      DEFAULT_STORAGE_QUOTA_BYTES;
    const currentBytes = usage._sum.byteSize ?? 0n;
    const replacedBytes = existingPart?.byteSize ?? 0n;
    const projectedBytes =
      currentBytes - replacedBytes + inputBytesToBigInt(incomingByteSize);

    if (projectedBytes > quotaBytes) {
      throw new ForbiddenException('Storage quota exceeded');
    }
  }
}
