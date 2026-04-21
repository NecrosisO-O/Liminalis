import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SessionActor } from '../common/decorators/session.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import type { AuthenticatedSession } from '../common/types/auth.types';
import { IdentityService } from '../identity/identity.service';

@Controller('api/admin/operations')
@UseGuards(SessionGuard)
export class AdminOperationsController {
  constructor(
    private readonly identityService: IdentityService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('summary')
  async getSummary(@SessionActor() sessionActor: AuthenticatedSession) {
    this.identityService.requireAdmin(sessionActor.role);

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
}
