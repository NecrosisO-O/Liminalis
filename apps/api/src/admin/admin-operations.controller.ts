import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { SessionGuard } from '../common/guards/session.guard';
import {
  DEFAULT_STORAGE_QUOTA_BYTES,
  bytesToJsonNumber,
  inputBytesToBigInt,
  sumBytes,
} from '../common/utils/byte-values';
import { SetStorageQuotaDto } from './dto/set-storage-quota.dto';
import { UpdateInstanceSettingsDto } from './dto/update-instance-settings.dto';

function normalizePublicOrigin(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.origin;
  } catch {
    throw new BadRequestException('Public origin must be a valid absolute URL');
  }
}

@Controller('api/admin/operations')
@UseGuards(SessionGuard, AdminGuard)
export class AdminOperationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('summary')
  async getSummary() {
    const [
      totalUsers,
      pendingUsers,
      enabledUsers,
      disabledUsers,
      activeInvites,
      consumedInvites,
      sourceItems,
      shares,
      uploadParts,
      trustedDevices,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { admissionState: 'PENDING_APPROVAL' } }),
      this.prisma.user.count({ where: { enablementState: 'ENABLED' } }),
      this.prisma.user.count({ where: { enablementState: 'DISABLED' } }),
      this.prisma.inviteCode.count({
        where: {
          consumedAt: null,
          invalidatedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
      this.prisma.inviteCode.count({ where: { consumedAt: { not: null } } }),
      this.prisma.sourceItem.count(),
      this.prisma.shareObject.count(),
      this.prisma.uploadPart.aggregate({ _sum: { byteSize: true } }),
      this.prisma.trustedDevice.count({ where: { trustState: 'TRUSTED' } }),
    ]);

    return {
      users: {
        totalUsers,
        pendingUsers,
        enabledUsers,
        disabledUsers,
      },
      invites: {
        activeInvites,
        consumedInvites,
      },
      objects: {
        sourceItems,
        shares,
        trustedDevices,
      },
      storage: {
        uploadedCiphertextBytes: bytesToJsonNumber(
          uploadParts._sum.byteSize ?? 0n,
        ),
      },
    };
  }

  @Get('storage/users')
  async getPerUserStorage() {
    const [settings, users] = await Promise.all([
      this.prisma.instanceSetting.findUnique({
        where: { singletonKey: 'default' },
        select: { defaultStorageQuotaBytes: true },
      }),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          username: true,
          role: true,
          admissionState: true,
          enablementState: true,
          storageQuotaBytes: true,
          uploadSessions: {
            select: {
              parts: {
                select: { byteSize: true },
              },
            },
          },
        },
      }),
    ]);

    const defaultQuotaBytes =
      settings?.defaultStorageQuotaBytes ?? DEFAULT_STORAGE_QUOTA_BYTES;

    return users.map((user) => {
      const storageUsedBytes = sumBytes(
        user.uploadSessions.flatMap((session) =>
          session.parts.map((part) => part.byteSize),
        ),
      );
      const storageQuotaBytes = user.storageQuotaBytes ?? defaultQuotaBytes;

      return {
        userId: user.id,
        username: user.username,
        role: user.role,
        admissionState: user.admissionState,
        enablementState: user.enablementState,
        storageUsedBytes: bytesToJsonNumber(storageUsedBytes),
        storageQuotaBytes: bytesToJsonNumber(storageQuotaBytes),
        hasCustomQuota: user.storageQuotaBytes !== null,
      };
    });
  }

  @Post('storage/quota')
  async setStorageQuota(@Body() input: SetStorageQuotaDto) {
    const quotaBytes = inputBytesToBigInt(input.quotaBytes);

    if (input.userId) {
      const user = await this.prisma.user.update({
        where: { id: input.userId },
        data: { storageQuotaBytes: quotaBytes },
        select: {
          id: true,
          username: true,
          storageQuotaBytes: true,
        },
      });

      return {
        ...user,
        storageQuotaBytes: bytesToJsonNumber(user.storageQuotaBytes),
      };
    }

    const settings = await this.prisma.instanceSetting.upsert({
      where: { singletonKey: 'default' },
      update: {
        defaultStorageQuotaBytes: quotaBytes ?? DEFAULT_STORAGE_QUOTA_BYTES,
      },
      create: {
        singletonKey: 'default',
        defaultStorageQuotaBytes: quotaBytes ?? DEFAULT_STORAGE_QUOTA_BYTES,
      },
      select: {
        singletonKey: true,
        defaultStorageQuotaBytes: true,
      },
    });

    return this.instanceSettingsForJson(settings);
  }

  @Get('settings')
  async getInstanceSettings() {
    const settings = await this.prisma.instanceSetting.upsert({
      where: { singletonKey: 'default' },
      update: {},
      create: {
        singletonKey: 'default',
        defaultStorageQuotaBytes: DEFAULT_STORAGE_QUOTA_BYTES,
      },
      select: {
        singletonKey: true,
        defaultConfidentialityLevel: true,
        defaultStorageQuotaBytes: true,
        publicOrigin: true,
      },
    });

    return this.instanceSettingsForJson(settings);
  }

  @Post('settings')
  async updateInstanceSettings(@Body() input: UpdateInstanceSettingsDto) {
    const shouldUpdatePublicOrigin = input.publicOrigin !== undefined;
    const publicOrigin = shouldUpdatePublicOrigin
      ? normalizePublicOrigin(input.publicOrigin)
      : undefined;
    const defaultStorageQuotaBytes = inputBytesToBigInt(
      input.defaultStorageQuotaBytes,
    );
    const settings = await this.prisma.instanceSetting.upsert({
      where: { singletonKey: 'default' },
      update: {
        ...(shouldUpdatePublicOrigin ? { publicOrigin } : {}),
        ...(input.defaultStorageQuotaBytes === undefined
          ? {}
          : { defaultStorageQuotaBytes: defaultStorageQuotaBytes! }),
      },
      create: {
        singletonKey: 'default',
        publicOrigin,
        defaultStorageQuotaBytes:
          defaultStorageQuotaBytes ?? DEFAULT_STORAGE_QUOTA_BYTES,
      },
      select: {
        singletonKey: true,
        defaultConfidentialityLevel: true,
        defaultStorageQuotaBytes: true,
        publicOrigin: true,
      },
    });

    return this.instanceSettingsForJson(settings);
  }

  private instanceSettingsForJson<
    T extends { defaultStorageQuotaBytes: bigint },
  >(settings: T) {
    return {
      ...settings,
      defaultStorageQuotaBytes: bytesToJsonNumber(
        settings.defaultStorageQuotaBytes,
      ),
    };
  }
}
