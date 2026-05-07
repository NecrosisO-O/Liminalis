import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import {
  AdmissionState,
  EnablementState,
  UserRole,
} from '../../generated/prisma/index.js';
import { bytesToJsonNumber } from '../common/utils/byte-values';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const noMatchId = '__liminalis_no_match__';

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values.filter(
        (value): value is string =>
          typeof value === 'string' && value.length > 0,
      ),
    ),
  );
}

function idIn(values: string[]) {
  return {
    in: values.length > 0 ? values : [noMatchId],
  };
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async register(input: RegisterDto) {
    const invite = await this.prisma.inviteCode.findUnique({
      where: { code: input.inviteCode },
    });

    if (
      !invite ||
      invite.invalidatedAt ||
      invite.consumedAt ||
      invite.expiresAt < new Date()
    ) {
      throw new BadRequestException('Invite code is invalid');
    }

    const existing = await this.prisma.user.findUnique({
      where: { username: input.username },
    });

    if (existing) {
      throw new BadRequestException('Username already exists');
    }

    const passwordHash = await argon2.hash(input.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username: input.username,
          email: input.email,
          passwordHash,
          role: UserRole.REGULAR_USER,
          admissionState: AdmissionState.PENDING_APPROVAL,
          enablementState: EnablementState.ENABLED,
        },
      });

      await tx.inviteCode.update({
        where: { id: invite.id },
        data: {
          consumedAt: new Date(),
          consumedById: created.id,
        },
      });

      return created;
    });

    return {
      id: user.id,
      username: user.username,
      admissionState: user.admissionState,
      enablementState: user.enablementState,
    };
  }

  async validateCredentials(input: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { username: input.username },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await argon2.verify(user.passwordHash, input.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  requireAdmin(role: UserRole) {
    if (role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin role required');
    }
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        devices: true,
        recoverySet: true,
        wrappingKeys: {
          where: { isCurrent: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async createInvite(createdById: string, expiresInMinutes: number) {
    if (expiresInMinutes <= 0 || expiresInMinutes > 240) {
      throw new BadRequestException(
        'Invite expiry must be between 1 and 240 minutes',
      );
    }

    return this.prisma.inviteCode.create({
      data: {
        code: crypto.randomUUID(),
        createdById,
        expiresAt: new Date(Date.now() + expiresInMinutes * 60_000),
      },
    });
  }

  async listInvites() {
    return this.prisma.inviteCode.findMany({
      include: {
        createdBy: {
          select: { id: true, username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async invalidateInvite(inviteId: string) {
    const invite = await this.prisma.inviteCode.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.consumedAt) {
      throw new BadRequestException('Consumed invite cannot be invalidated');
    }

    if (invite.invalidatedAt) {
      return invite;
    }

    return this.prisma.inviteCode.update({
      where: { id: inviteId },
      data: { invalidatedAt: new Date() },
    });
  }

  async listPendingUsers() {
    const users = await this.prisma.user.findMany({
      where: { admissionState: AdmissionState.PENDING_APPROVAL },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        admissionState: true,
        enablementState: true,
        approvedAt: true,
        approvedById: true,
        storageQuotaBytes: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return users.map((user) => this.userForJson(user));
  }

  async listUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        admissionState: true,
        enablementState: true,
        approvedAt: true,
        approvedById: true,
        storageQuotaBytes: true,
        createdAt: true,
        updatedAt: true,
        devices: {
          where: { trustState: 'TRUSTED' },
          select: { id: true, label: true, trustEstablishedAt: true },
        },
      },
    });

    return users.map((user) => this.userForJson(user));
  }

  async approveUser(userId: string, adminId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        admissionState: AdmissionState.APPROVED,
        approvedAt: new Date(),
        approvedById: adminId,
      },
      select: this.safeUserProjection(),
    });

    return this.userForJson(user);
  }

  async disableUser(userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { enablementState: EnablementState.DISABLED },
      select: this.safeUserProjection(),
    });

    return this.userForJson(user);
  }

  async enableUser(userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { enablementState: EnablementState.ENABLED },
      select: this.safeUserProjection(),
    });

    return this.userForJson(user);
  }

  async removeUser(userId: string, adminId: string, confirmUsername: string) {
    if (userId === adminId) {
      throw new BadRequestException('Admins cannot remove their own account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Admin users cannot be removed');
    }

    if (confirmUsername !== user.username) {
      throw new BadRequestException('Confirmation username does not match');
    }

    const deviceIds = uniqueStrings(
      (
        await this.prisma.trustedDevice.findMany({
          where: { userId },
          select: { id: true },
        })
      ).map((device) => device.id),
    );

    const sessionIds = uniqueStrings(
      (
        await this.prisma.session.findMany({
          where: { userId },
          select: { id: true },
        })
      ).map((session) => session.id),
    );

    const sourceItemIds = uniqueStrings(
      (
        await this.prisma.sourceItem.findMany({
          where: { ownerUserId: userId },
          select: { id: true },
        })
      ).map((item) => item.id),
    );

    const shareObjectIds = uniqueStrings(
      (
        await this.prisma.shareObject.findMany({
          where: {
            OR: [
              { ownerUserId: userId },
              { recipientUserId: userId },
              { sourceItemId: idIn(sourceItemIds) },
            ],
          },
          select: { id: true },
        })
      ).map((share) => share.id),
    );

    const extractionAccessIds = uniqueStrings(
      (
        await this.prisma.extractionAccess.findMany({
          where: {
            OR: [
              { sourceItemId: idIn(sourceItemIds) },
              { shareObjectId: idIn(shareObjectIds) },
            ],
          },
          select: { id: true },
        })
      ).map((extraction) => extraction.id),
    );

    const publicLinkIds = uniqueStrings(
      (
        await this.prisma.publicLink.findMany({
          where: {
            OR: [
              { sourceItemId: idIn(sourceItemIds) },
              { shareObjectId: idIn(shareObjectIds) },
            ],
          },
          select: { id: true },
        })
      ).map((publicLink) => publicLink.id),
    );

    const packageFamilyIds = uniqueStrings(
      (
        await this.prisma.packageFamily.findMany({
          where: {
            OR: [
              { sourceItemId: idIn(sourceItemIds) },
              { shareObjectId: idIn(shareObjectIds) },
              { extractionAccessId: idIn(extractionAccessIds) },
            ],
          },
          select: { id: true },
        })
      ).map((family) => family.id),
    );

    const packageReferences = await this.prisma.packageReference.findMany({
      where: {
        OR: [
          { packageFamilyId: idIn(packageFamilyIds) },
          { eligibleSubjectUserId: userId },
          { eligibleSubjectDeviceId: idIn(deviceIds) },
        ],
      },
      select: { id: true },
    });
    const packageReferenceIds = uniqueStrings(
      packageReferences.map((reference) => reference.id),
    );

    const retrievalAttempts = await this.prisma.retrievalAttempt.findMany({
      where: {
        OR: [
          { requestingUserId: userId },
          { requestingDeviceId: idIn(deviceIds) },
          { sourceItemId: idIn(sourceItemIds) },
          { shareObjectId: idIn(shareObjectIds) },
          { extractionAccessId: idIn(extractionAccessIds) },
          { packageReferenceId: idIn(packageReferenceIds) },
        ],
      },
      select: { id: true, packageReferenceId: true },
    });
    const retrievalAttemptIds = uniqueStrings(
      retrievalAttempts.map((attempt) => attempt.id),
    );
    const retrievalPackageReferenceIds = uniqueStrings(
      retrievalAttempts.map((attempt) => attempt.packageReferenceId),
    );
    const allPackageReferenceIds = uniqueStrings([
      ...packageReferenceIds,
      ...retrievalPackageReferenceIds,
    ]);

    const liveTransferSessions = await this.prisma.liveTransferSession.findMany(
      {
        where: {
          OR: [
            { initiatorUserId: userId },
            { joinerUserId: userId },
            { initiatorDeviceId: idIn(deviceIds) },
            { joinerDeviceId: idIn(deviceIds) },
          ],
        },
        select: { id: true, storedFallbackUploadSessionId: true },
      },
    );
    const liveTransferSessionIds = uniqueStrings(
      liveTransferSessions.map((session) => session.id),
    );
    const storedFallbackUploadSessionIds = uniqueStrings(
      liveTransferSessions.map(
        (session) => session.storedFallbackUploadSessionId,
      ),
    );

    const uploadSessionIds = uniqueStrings(
      (
        await this.prisma.uploadSession.findMany({
          where: {
            OR: [
              { uploaderUserId: userId },
              { finalizedSourceItemId: idIn(sourceItemIds) },
              { id: idIn(storedFallbackUploadSessionIds) },
            ],
          },
          select: { id: true },
        })
      ).map((session) => session.id),
    );

    const uploadPartStorageKeys = uniqueStrings(
      (
        await this.prisma.uploadPart.findMany({
          where: { uploadSessionId: idIn(uploadSessionIds) },
          select: { storageKey: true },
        })
      ).map((part) => part.storageKey),
    );

    const relayChunkStorageKeys = uniqueStrings(
      (
        await this.prisma.liveTransferRelayChunk.findMany({
          where: { sessionId: idIn(liveTransferSessionIds) },
          select: { storageKey: true },
        })
      ).map((chunk) => chunk.storageKey),
    );

    const storageKeys = uniqueStrings([
      ...uploadPartStorageKeys,
      ...relayChunkStorageKeys,
    ]);

    await this.prisma.$transaction(async (tx) => {
      await tx.trustedDeviceResumeChallenge.deleteMany({
        where: {
          OR: [
            { userId },
            { sessionId: idIn(sessionIds) },
            { trustedDeviceId: idIn(deviceIds) },
          ],
        },
      });

      await tx.liveTransferSignalMessage.deleteMany({
        where: {
          OR: [
            { sessionId: idIn(liveTransferSessionIds) },
            { senderUserId: userId },
            { recipientUserId: userId },
            { senderDeviceId: idIn(deviceIds) },
            { recipientDeviceId: idIn(deviceIds) },
          ],
        },
      });
      await tx.liveTransferRelayChunk.deleteMany({
        where: { sessionId: idIn(liveTransferSessionIds) },
      });
      await tx.liveTransferRecordProjection.deleteMany({
        where: {
          OR: [
            { ownerUserId: userId },
            { liveTransferSessionId: idIn(liveTransferSessionIds) },
          ],
        },
      });
      await tx.liveTransferSession.deleteMany({
        where: { id: idIn(liveTransferSessionIds) },
      });

      await tx.retrievalAttempt.deleteMany({
        where: { id: idIn(retrievalAttemptIds) },
      });
      await tx.packageReference.deleteMany({
        where: { id: idIn(allPackageReferenceIds) },
      });
      await tx.accessGrantSet.deleteMany({
        where: {
          OR: [
            { sourceItemId: idIn(sourceItemIds) },
            { shareObjectId: idIn(shareObjectIds) },
            { subjectUserId: userId },
            { ordinaryPackageFamilyId: idIn(packageFamilyIds) },
            { recoveryPackageFamilyId: idIn(packageFamilyIds) },
          ],
        },
      });
      await tx.packageFamily.deleteMany({
        where: { id: idIn(packageFamilyIds) },
      });

      await tx.publicLinkDeliveryTicket.deleteMany({
        where: { publicLinkId: idIn(publicLinkIds) },
      });
      await tx.activeTimelineItemProjection.deleteMany({
        where: {
          OR: [
            { ownerUserId: userId },
            { sourceItemId: idIn(sourceItemIds) },
            { shareObjectId: idIn(shareObjectIds) },
          ],
        },
      });
      await tx.historyEntryProjection.deleteMany({
        where: {
          OR: [
            { ownerUserId: userId },
            { sourceItemId: idIn(sourceItemIds) },
            { shareObjectId: idIn(shareObjectIds) },
          ],
        },
      });
      await tx.searchDocumentProjection.deleteMany({
        where: {
          OR: [
            { ownerUserId: userId },
            { sourceItemId: idIn(sourceItemIds) },
            { shareObjectId: idIn(shareObjectIds) },
          ],
        },
      });

      await tx.publicLink.deleteMany({ where: { id: idIn(publicLinkIds) } });
      await tx.extractionAccess.deleteMany({
        where: { id: idIn(extractionAccessIds) },
      });
      await tx.shareObject.deleteMany({ where: { id: idIn(shareObjectIds) } });
      await tx.groupManifest.deleteMany({
        where: { sourceItemId: idIn(sourceItemIds) },
      });
      await tx.uploadPart.deleteMany({
        where: { uploadSessionId: idIn(uploadSessionIds) },
      });
      await tx.uploadSession.deleteMany({
        where: { id: idIn(uploadSessionIds) },
      });
      await tx.sourceItem.deleteMany({ where: { id: idIn(sourceItemIds) } });

      await tx.pairingSession.deleteMany({
        where: {
          OR: [
            { requesterDeviceId: idIn(deviceIds) },
            { approverDeviceId: idIn(deviceIds) },
          ],
        },
      });
      await tx.trustedDevice.deleteMany({ where: { userId } });
      await tx.session.deleteMany({ where: { userId } });
      await tx.recoveryCredentialSet.deleteMany({ where: { userId } });
      await tx.userDomainWrappingKey.deleteMany({ where: { userId } });
      await tx.inviteCode.deleteMany({
        where: {
          OR: [{ createdById: userId }, { consumedById: userId }],
        },
      });
      await tx.user.delete({ where: { id: userId } });
    });

    const storageCleanupFailures: Array<{
      storageKey: string;
      message: string;
    }> = [];

    for (const storageKey of storageKeys) {
      await this.storageService.remove(storageKey).catch((error: unknown) => {
        storageCleanupFailures.push({
          storageKey,
          message: messageFromError(error),
        });
      });
    }

    return {
      removedUserId: user.id,
      username: user.username,
      removedStorageObjects: storageKeys.length - storageCleanupFailures.length,
      storageCleanupFailures,
    };
  }

  private safeUserProjection() {
    return {
      id: true,
      username: true,
      email: true,
      role: true,
      admissionState: true,
      enablementState: true,
      approvedAt: true,
      approvedById: true,
      storageQuotaBytes: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }

  private userForJson<T extends { storageQuotaBytes: bigint | null }>(user: T) {
    return {
      ...user,
      storageQuotaBytes: bytesToJsonNumber(user.storageQuotaBytes),
    };
  }
}
