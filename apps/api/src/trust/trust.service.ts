import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomInt, randomUUID } from 'crypto';
import {
  DeviceTrustState,
  PairingSessionState,
} from '../../generated/prisma/index.js';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovePairingDto } from './dto/approve-pairing.dto';
import { CreatePairingSessionDto } from './dto/create-pairing-session.dto';
import { FirstDeviceBootstrapDto } from './dto/first-device-bootstrap.dto';
import { RecoveryAttemptDto } from './dto/recovery-attempt.dto';
import { RejectPairingDto } from './dto/reject-pairing.dto';

function generateRecoveryCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 20 }, () => alphabet[randomInt(0, alphabet.length)]).join('');
}

@Injectable()
export class TrustService {
  constructor(private readonly prisma: PrismaService) {}

  async bootstrapFirstDevice(userId: string, input: FirstDeviceBootstrapDto) {
    const existingTrusted = await this.prisma.trustedDevice.findFirst({
      where: { userId, trustState: DeviceTrustState.TRUSTED },
    });

    if (existingTrusted) {
      throw new BadRequestException('Trusted device already exists');
    }

    const codes = [generateRecoveryCode(), generateRecoveryCode(), generateRecoveryCode()];

    const [codeHashOne, codeHashTwo, codeHashThree] = await Promise.all(
      codes.map((code) => argon2.hash(code)),
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const device = await tx.trustedDevice.create({
        data: {
          userId,
          label: input.deviceLabel,
          trustState: DeviceTrustState.TRUSTED,
          trustEstablishedAt: new Date(),
          publicIdentityPayload: input.devicePublicIdentity,
        },
      });

      await tx.userDomainWrappingKey.create({
        data: {
          userId,
          version: 1,
          publicKey: input.userDomainPublicKey,
          isCurrent: true,
        },
      });

      await tx.recoveryCredentialSet.create({
        data: {
          userId,
          codeHashOne,
          codeHashTwo,
          codeHashThree,
          pendingDisplayBlob: JSON.stringify(codes),
          pendingDisplayUntil: new Date(Date.now() + 30 * 60_000),
        },
      });

      return { device };
    });

    return {
      trustedDeviceId: result.device.id,
      recoveryCodes: codes,
    };
  }

  async createPairingSession(userId: string, input: CreatePairingSessionDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.enablementState === 'DISABLED') {
      throw new ForbiddenException('User cannot establish trust');
    }

    const device = await this.prisma.trustedDevice.create({
      data: {
        userId,
        label: input.deviceLabel,
        trustState: DeviceTrustState.UNTRUSTED,
        publicIdentityPayload: input.devicePublicIdentity,
      },
    });

    const shortCode = String(randomInt(100000, 999999));

    return this.prisma.pairingSession.create({
      data: {
        requesterDeviceId: device.id,
        qrToken: randomUUID(),
        shortCode,
        expiresAt: new Date(Date.now() + 5 * 60_000),
      },
    });
  }

  async getPairingSession(pairingSessionId: string) {
    const session = await this.prisma.pairingSession.findUnique({
      where: { id: pairingSessionId },
      include: { requesterDevice: true, approverDevice: true },
    });

    if (!session) {
      throw new NotFoundException('Pairing session not found');
    }

    if (session.expiresAt < new Date() && session.state !== PairingSessionState.TRUSTED) {
      return this.prisma.pairingSession.update({
        where: { id: session.id },
        data: { state: PairingSessionState.EXPIRED },
        include: { requesterDevice: true, approverDevice: true },
      });
    }

    return session;
  }

  async approvePairing(userId: string, input: ApprovePairingDto) {
    const session = await this.getPairingSession(input.pairingSessionId);

    if (session.requesterDevice.userId !== userId) {
      throw new BadRequestException('Pairing session belongs to a different user');
    }

    if (session.state !== PairingSessionState.AWAITING_PAIR) {
      throw new BadRequestException('Pairing session is not awaiting approval');
    }

    const approver = await this.prisma.trustedDevice.findFirst({
      where: { userId, trustState: DeviceTrustState.TRUSTED },
      orderBy: { trustEstablishedAt: 'asc' },
    });

    if (!approver) {
      throw new BadRequestException('No trusted approver device');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.trustedDevice.update({
        where: { id: session.requesterDeviceId },
        data: {
          trustState: DeviceTrustState.TRUSTED,
          trustEstablishedAt: new Date(),
        },
      });

      return tx.pairingSession.update({
        where: { id: session.id },
        data: {
          state: PairingSessionState.TRUSTED,
          approverDeviceId: approver.id,
          approvedAt: new Date(),
        },
      });
    });
  }

  async rejectPairing(userId: string, input: RejectPairingDto) {
    const session = await this.getPairingSession(input.pairingSessionId);

    if (session.requesterDevice.userId !== userId) {
      throw new BadRequestException('Pairing session belongs to a different user');
    }

    if (session.state !== PairingSessionState.AWAITING_PAIR) {
      throw new BadRequestException('Pairing session is not awaiting approval');
    }

    const approver = await this.prisma.trustedDevice.findFirst({
      where: { userId, trustState: DeviceTrustState.TRUSTED },
      orderBy: { trustEstablishedAt: 'asc' },
    });

    if (!approver) {
      throw new BadRequestException('No trusted approver device');
    }

    return this.prisma.pairingSession.update({
      where: { id: session.id },
      data: {
        state: PairingSessionState.REJECTED,
        approverDeviceId: approver.id,
        rejectedAt: new Date(),
      },
    });
  }

  async resolvePairingByShortCode(shortCode: string) {
    const session = await this.prisma.pairingSession.findUnique({
      where: { shortCode },
      include: { requesterDevice: true },
    });

    if (!session) {
      throw new NotFoundException('Pairing session not found');
    }

    if (session.expiresAt < new Date() && session.state !== PairingSessionState.TRUSTED) {
      throw new BadRequestException('Pairing session expired');
    }

    return session;
  }

  async resolvePairingByQrToken(qrToken: string) {
    const session = await this.prisma.pairingSession.findUnique({
      where: { qrToken },
      include: { requesterDevice: true },
    });

    if (!session) {
      throw new NotFoundException('Pairing session not found');
    }

    if (session.expiresAt < new Date() && session.state !== PairingSessionState.TRUSTED) {
      throw new BadRequestException('Pairing session expired');
    }

    return session;
  }

  async recoveryAttempt(userId: string, input: RecoveryAttemptDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.enablementState === 'DISABLED') {
      throw new ForbiddenException('User cannot complete recovery');
    }

    const recoverySet = await this.prisma.recoveryCredentialSet.findUnique({
      where: { userId },
    });

    if (!recoverySet) {
      throw new NotFoundException('Recovery set not found');
    }

    const [one, two, three] = await Promise.all([
      argon2.verify(recoverySet.codeHashOne, input.recoveryCode).catch(() => false),
      argon2.verify(recoverySet.codeHashTwo, input.recoveryCode).catch(() => false),
      argon2.verify(recoverySet.codeHashThree, input.recoveryCode).catch(() => false),
    ]);

    if (!one && !two && !three) {
      throw new BadRequestException('Recovery code is invalid');
    }

    const codes = [generateRecoveryCode(), generateRecoveryCode(), generateRecoveryCode()];
    const [codeHashOne, codeHashTwo, codeHashThree] = await Promise.all(
      codes.map((code) => argon2.hash(code)),
    );

    const device = await this.prisma.trustedDevice.create({
      data: {
        userId,
        label: input.deviceLabel,
        trustState: DeviceTrustState.UNTRUSTED,
        publicIdentityPayload: input.devicePublicIdentity,
      },
    });

    await this.prisma.recoveryCredentialSet.update({
      where: { userId },
      data: {
        codeHashOne,
        codeHashTwo,
        codeHashThree,
        pendingDisplayBlob: JSON.stringify(codes),
        pendingDisplayUntil: new Date(Date.now() + 30 * 60_000),
        rotatedAt: new Date(),
        acknowledgedAt: null,
      },
    });

    return {
      pendingTrustedDeviceId: device.id,
      recoveryCodes: codes,
    };
  }

  async acknowledgeRecoveryRotation(userId: string, trustedDeviceId: string) {
    const device = await this.prisma.trustedDevice.findUnique({ where: { id: trustedDeviceId } });

    if (!device || device.userId !== userId) {
      throw new NotFoundException('Trusted device not found');
    }

    await this.prisma.trustedDevice.update({
      where: { id: trustedDeviceId },
      data: {
        trustState: DeviceTrustState.TRUSTED,
        trustEstablishedAt: new Date(),
      },
    });

    return this.prisma.recoveryCredentialSet.update({
      where: { userId },
      data: {
        pendingDisplayBlob: null,
        pendingDisplayUntil: null,
        acknowledgedAt: new Date(),
      },
    });
  }

  async getPendingRecoveryDisplay(userId: string) {
    const recoverySet = await this.prisma.recoveryCredentialSet.findUnique({
      where: { userId },
    });

    if (!recoverySet?.pendingDisplayBlob || !recoverySet.pendingDisplayUntil) {
      throw new NotFoundException('No pending recovery display');
    }

    if (recoverySet.pendingDisplayUntil < new Date()) {
      await this.prisma.recoveryCredentialSet.update({
        where: { userId },
        data: {
          pendingDisplayBlob: null,
          pendingDisplayUntil: null,
        },
      });
      throw new BadRequestException('Pending recovery display expired');
    }

    return {
      recoveryCodes: JSON.parse(recoverySet.pendingDisplayBlob) as string[],
    };
  }
}
