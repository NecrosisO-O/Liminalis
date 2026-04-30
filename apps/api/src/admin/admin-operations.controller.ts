import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { SessionGuard } from '../common/guards/session.guard';
import { SetStorageQuotaDto } from './dto/set-storage-quota.dto';

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
      this.prisma.inviteCode.count({ where: { consumedAt: null, invalidatedAt: null, expiresAt: { gt: new Date() } } }),
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
        uploadedCiphertextBytes: uploadParts._sum.byteSize ?? 0,
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

    const defaultQuotaBytes = settings?.defaultStorageQuotaBytes ?? 1_073_741_824;

    return users.map((user) => {
      const storageUsedBytes = user.uploadSessions.reduce(
        (userTotal, session) =>
          userTotal + session.parts.reduce((sessionTotal, part) => sessionTotal + part.byteSize, 0),
        0,
      );

      return {
        userId: user.id,
        username: user.username,
        role: user.role,
        admissionState: user.admissionState,
        enablementState: user.enablementState,
        storageUsedBytes,
        storageQuotaBytes: user.storageQuotaBytes ?? defaultQuotaBytes,
        hasCustomQuota: user.storageQuotaBytes !== null,
      };
    });
  }

  @Post('storage/quota')
  async setStorageQuota(@Body() input: SetStorageQuotaDto) {
    if (input.userId) {
      return this.prisma.user.update({
        where: { id: input.userId },
        data: { storageQuotaBytes: input.quotaBytes ?? null },
        select: {
          id: true,
          username: true,
          storageQuotaBytes: true,
        },
      });
    }

    return this.prisma.instanceSetting.upsert({
      where: { singletonKey: 'default' },
      update: { defaultStorageQuotaBytes: input.quotaBytes ?? 1_073_741_824 },
      create: {
        singletonKey: 'default',
        defaultStorageQuotaBytes: input.quotaBytes ?? 1_073_741_824,
      },
      select: {
        singletonKey: true,
        defaultStorageQuotaBytes: true,
      },
    });
  }
}
