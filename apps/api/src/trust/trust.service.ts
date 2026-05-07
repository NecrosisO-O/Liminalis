import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes, randomInt, randomUUID, webcrypto } from 'crypto';
import {
  AdmissionState,
  DeviceTrustState,
  EnablementState,
  PairingSessionState,
  Prisma,
} from '../../generated/prisma/index.js';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovePairingDto } from './dto/approve-pairing.dto';
import { CompleteTrustedDeviceResumeDto } from './dto/complete-trusted-device-resume.dto';
import { CreatePairingSessionDto } from './dto/create-pairing-session.dto';
import { CreateTrustedDeviceResumeChallengeDto } from './dto/create-trusted-device-resume-challenge.dto';
import { FirstDeviceBootstrapDto } from './dto/first-device-bootstrap.dto';
import { FinalizePairingDto } from './dto/finalize-pairing.dto';
import { RecoveryAttemptDto } from './dto/recovery-attempt.dto';
import { RejectPairingDto } from './dto/reject-pairing.dto';

const trustedDeviceResumeVersion = 'liminalis-trusted-device-resume-v1';
const trustedDeviceResumeChallengeTtlMs = 2 * 60 * 1000;

function generateRecoveryCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(
    { length: 20 },
    () => alphabet[randomInt(0, alphabet.length)],
  ).join('');
}

function base64UrlBytes(byteLength: number) {
  return randomBytes(byteLength).toString('base64url');
}

function bytesFromBase64Url(value: string) {
  return Uint8Array.from(Buffer.from(value, 'base64url'));
}

async function verifyTrustedDeviceSignature(input: {
  publicIdentityPayload: string;
  challenge: string;
  signature: string;
}) {
  const publicKey = await webcrypto.subtle.importKey(
    'jwk',
    JSON.parse(input.publicIdentityPayload) as JsonWebKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );

  return webcrypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publicKey,
    bytesFromBase64Url(input.signature),
    new TextEncoder().encode(input.challenge),
  );
}

@Injectable()
export class TrustService {
  constructor(private readonly prisma: PrismaService) {}

  async bootstrapFirstDevice(userId: string, input: FirstDeviceBootstrapDto) {
    await this.requireApprovedEnabledUser(
      userId,
      'User cannot establish trust',
    );

    const existingTrusted = await this.prisma.trustedDevice.findFirst({
      where: { userId, trustState: DeviceTrustState.TRUSTED },
    });

    if (existingTrusted) {
      throw new BadRequestException('Trusted device already exists');
    }

    const codes = [
      generateRecoveryCode(),
      generateRecoveryCode(),
      generateRecoveryCode(),
    ];

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
          deviceWrappingPublicKey: input.deviceWrappingPublicKey,
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
    await this.requireApprovedEnabledUser(
      userId,
      'User cannot establish trust',
    );

    const device = await this.prisma.trustedDevice.create({
      data: {
        userId,
        label: input.deviceLabel,
        trustState: DeviceTrustState.UNTRUSTED,
        publicIdentityPayload: input.devicePublicIdentity,
        deviceWrappingPublicKey: input.deviceWrappingPublicKey,
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

  async createTrustedDeviceResumeChallenge(
    userId: string,
    sessionId: string,
    input: CreateTrustedDeviceResumeChallengeDto,
  ) {
    await this.requireApprovedEnabledUser(
      userId,
      'User cannot resume trusted browser',
    );

    const device = await this.prisma.trustedDevice.findFirst({
      where: {
        userId,
        trustState: DeviceTrustState.TRUSTED,
        publicIdentityPayload: input.devicePublicIdentity,
      },
      select: { id: true },
    });

    if (!device) {
      throw new NotFoundException('Trusted device not found');
    }

    const expiresAt = new Date(Date.now() + trustedDeviceResumeChallengeTtlMs);
    const challenge = JSON.stringify({
      version: trustedDeviceResumeVersion,
      userId,
      sessionId,
      trustedDeviceId: device.id,
      nonce: base64UrlBytes(32),
      expiresAt: expiresAt.toISOString(),
    });

    const record = await this.prisma.trustedDeviceResumeChallenge.create({
      data: {
        userId,
        sessionId,
        trustedDeviceId: device.id,
        challenge,
        expiresAt,
      },
    });

    return {
      challengeId: record.id,
      challenge: record.challenge,
      expiresAt: record.expiresAt,
    };
  }

  async completeTrustedDeviceResume(
    userId: string,
    sessionId: string,
    input: CompleteTrustedDeviceResumeDto,
  ) {
    await this.requireApprovedEnabledUser(
      userId,
      'User cannot resume trusted browser',
    );

    const challenge = await this.prisma.trustedDeviceResumeChallenge.findUnique(
      {
        where: { id: input.challengeId },
        include: { trustedDevice: true },
      },
    );

    if (
      !challenge ||
      challenge.userId !== userId ||
      challenge.sessionId !== sessionId ||
      challenge.consumedAt ||
      challenge.expiresAt < new Date()
    ) {
      throw new BadRequestException('Trusted browser resume expired');
    }

    if (
      challenge.trustedDevice.trustState !== DeviceTrustState.TRUSTED ||
      !challenge.trustedDevice.publicIdentityPayload
    ) {
      throw new ForbiddenException('Trusted browser is not available');
    }

    const verified = await verifyTrustedDeviceSignature({
      publicIdentityPayload: challenge.trustedDevice.publicIdentityPayload,
      challenge: challenge.challenge,
      signature: input.signature,
    }).catch(() => false);

    if (!verified) {
      throw new ForbiddenException('Trusted browser proof is invalid');
    }

    const consumed = await this.prisma.trustedDeviceResumeChallenge.updateMany({
      where: {
        id: challenge.id,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });

    if (consumed.count !== 1) {
      throw new BadRequestException('Trusted browser resume expired');
    }

    return {
      trustedDeviceId: challenge.trustedDeviceId,
    };
  }

  async getPairingSession(pairingSessionId: string) {
    const session = await this.prisma.pairingSession.findUnique({
      where: { id: pairingSessionId },
      include: { requesterDevice: true, approverDevice: true },
    });

    if (!session) {
      throw new NotFoundException('Pairing session not found');
    }

    if (
      session.expiresAt < new Date() &&
      session.state !== PairingSessionState.TRUSTED
    ) {
      return this.prisma.pairingSession.update({
        where: { id: session.id },
        data: { state: PairingSessionState.EXPIRED },
        include: { requesterDevice: true, approverDevice: true },
      });
    }

    return session;
  }

  async approvePairing(
    userId: string,
    trustedDeviceId: string | null,
    input: ApprovePairingDto,
  ) {
    await this.requireTrustedActorDevice(userId, trustedDeviceId);

    const session = await this.getPairingSession(input.pairingSessionId);

    if (session.requesterDevice.userId !== userId) {
      throw new BadRequestException(
        'Pairing session belongs to a different user',
      );
    }

    if (session.state !== PairingSessionState.AWAITING_PAIR) {
      throw new BadRequestException('Pairing session is not awaiting approval');
    }

    return this.prisma.$transaction(async (tx) => {
      return tx.pairingSession.update({
        where: { id: session.id },
        data: {
          state: PairingSessionState.AWAITING_APPROVAL,
          approverDeviceId: trustedDeviceId,
          approvalPackage: input.approvalPackage as Prisma.InputJsonValue,
          approvedAt: new Date(),
        },
        include: { requesterDevice: true, approverDevice: true },
      });
    });
  }

  async finalizePairing(userId: string, input: FinalizePairingDto) {
    const session = await this.getPairingSession(input.pairingSessionId);

    if (session.requesterDevice.userId !== userId) {
      throw new BadRequestException(
        'Pairing session belongs to a different user',
      );
    }

    if (
      session.state !== PairingSessionState.AWAITING_APPROVAL ||
      !session.approvalPackage
    ) {
      throw new BadRequestException('Pairing session is not ready to finalize');
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
        },
        include: { requesterDevice: true, approverDevice: true },
      });
    });
  }

  async rejectPairing(
    userId: string,
    trustedDeviceId: string | null,
    input: RejectPairingDto,
  ) {
    await this.requireTrustedActorDevice(userId, trustedDeviceId);

    const session = await this.getPairingSession(input.pairingSessionId);

    if (session.requesterDevice.userId !== userId) {
      throw new BadRequestException(
        'Pairing session belongs to a different user',
      );
    }

    if (session.state !== PairingSessionState.AWAITING_PAIR) {
      throw new BadRequestException('Pairing session is not awaiting approval');
    }

    return this.prisma.pairingSession.update({
      where: { id: session.id },
      data: {
        state: PairingSessionState.REJECTED,
        approverDeviceId: trustedDeviceId,
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

    if (
      session.expiresAt < new Date() &&
      session.state !== PairingSessionState.TRUSTED
    ) {
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

    if (
      session.expiresAt < new Date() &&
      session.state !== PairingSessionState.TRUSTED
    ) {
      throw new BadRequestException('Pairing session expired');
    }

    return session;
  }

  async recoveryAttempt(userId: string, input: RecoveryAttemptDto) {
    await this.requireApprovedEnabledUser(
      userId,
      'User cannot complete recovery',
    );

    const recoverySet = await this.prisma.recoveryCredentialSet.findUnique({
      where: { userId },
    });

    if (!recoverySet) {
      throw new NotFoundException('Recovery set not found');
    }

    const [one, two, three] = await Promise.all([
      argon2
        .verify(recoverySet.codeHashOne, input.recoveryCode)
        .catch(() => false),
      argon2
        .verify(recoverySet.codeHashTwo, input.recoveryCode)
        .catch(() => false),
      argon2
        .verify(recoverySet.codeHashThree, input.recoveryCode)
        .catch(() => false),
    ]);

    if (!one && !two && !three) {
      throw new BadRequestException('Recovery code is invalid');
    }

    const codes = [
      generateRecoveryCode(),
      generateRecoveryCode(),
      generateRecoveryCode(),
    ];
    const [codeHashOne, codeHashTwo, codeHashThree] = await Promise.all(
      codes.map((code) => argon2.hash(code)),
    );

    const device = await this.prisma.$transaction(async (tx) => {
      const createdDevice = await tx.trustedDevice.create({
        data: {
          userId,
          label: input.deviceLabel,
          trustState: DeviceTrustState.UNTRUSTED,
          recoveryRequestedAt: new Date(),
          publicIdentityPayload: input.devicePublicIdentity,
          deviceWrappingPublicKey: input.deviceWrappingPublicKey,
        },
      });

      if (input.userDomainPublicKey) {
        const latestKey = await tx.userDomainWrappingKey.findFirst({
          where: { userId },
          orderBy: { version: 'desc' },
          select: { version: true },
        });

        await tx.userDomainWrappingKey.updateMany({
          where: { userId, isCurrent: true },
          data: { isCurrent: false },
        });

        await tx.userDomainWrappingKey.create({
          data: {
            userId,
            version: (latestKey?.version ?? 0) + 1,
            publicKey: input.userDomainPublicKey,
            isCurrent: true,
          },
        });
      }

      await tx.recoveryCredentialSet.update({
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

      return createdDevice;
    });

    return {
      pendingTrustedDeviceId: device.id,
      recoveryCodes: codes,
    };
  }

  async acknowledgeRecoveryRotation(userId: string, trustedDeviceId: string) {
    await this.requireApprovedEnabledUser(
      userId,
      'User cannot complete recovery',
    );

    const device = await this.prisma.trustedDevice.findUnique({
      where: { id: trustedDeviceId },
    });

    if (!device || device.userId !== userId) {
      throw new NotFoundException('Trusted device not found');
    }

    if (device.recoveryRequestedAt) {
      await this.prisma.trustedDevice.update({
        where: { id: trustedDeviceId },
        data: {
          trustState: DeviceTrustState.TRUSTED,
          trustEstablishedAt: new Date(),
          recoveryEstablishedAt: new Date(),
        },
      });
    } else if (device.trustState !== DeviceTrustState.TRUSTED) {
      throw new NotFoundException('Trusted device not found');
    }

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
    await this.requireApprovedEnabledUser(
      userId,
      'User cannot view recovery codes',
    );

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

  private async requireApprovedEnabledUser(userId: string, message: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (
      !user ||
      user.enablementState !== EnablementState.ENABLED ||
      user.admissionState !== AdmissionState.APPROVED
    ) {
      throw new ForbiddenException(message);
    }

    return user;
  }

  private async requireTrustedActorDevice(
    userId: string,
    trustedDeviceId: string | null,
  ) {
    if (!trustedDeviceId) {
      throw new ForbiddenException('Trusted approver device required');
    }

    const device = await this.prisma.trustedDevice.findFirst({
      where: {
        id: trustedDeviceId,
        userId,
        trustState: DeviceTrustState.TRUSTED,
      },
    });

    if (!device) {
      throw new ForbiddenException('Trusted approver device required');
    }

    return device;
  }
}
