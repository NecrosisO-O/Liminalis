import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/index.js';
import {
  LiveTransferSessionState,
  LiveTransferTransportState,
  type UploadContentKind,
} from '../../generated/prisma/index.js';
import { PolicyService } from '../policy/policy.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLiveTransferDto } from './dto/create-live-transfer.dto';
import { UpdateLiveTransportDto } from './dto/update-live-transport.dto';

@Injectable()
export class LiveTransferService {
  private readonly awaitingJoinTtlMs = 5 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
  ) {}

  async createSession(userId: string, trustedDeviceId: string | null, input: CreateLiveTransferDto) {
    if (!trustedDeviceId) {
      throw new ForbiddenException('Trusted device required');
    }

    const confidentialityLevel =
      input.confidentialityLevel ?? (await this.policyService.getDefaultConfidentialityLevel());

    const decision = await this.policyService.evaluateLiveTransferCreation({
      confidentialityLevel,
      groupedTransfer: input.groupedTransfer ?? false,
      contentKind: input.contentKind,
    });

    const sessionCode = crypto.randomUUID().slice(0, 8);

    const session = await this.prisma.liveTransferSession.create({
      data: {
        initiatorUserId: userId,
        initiatorDeviceId: trustedDeviceId,
        confidentialityLevel,
        policyBundleId: decision.policyBundle.id,
        policySnapshot: decision.snapshotFieldsToPersist as Prisma.InputJsonValue,
        state: LiveTransferSessionState.AWAITING_JOIN,
        contentLabel: input.contentLabel,
        contentKind: input.contentKind,
        groupedTransfer: input.groupedTransfer ?? false,
        relayAllowed: decision.allowRelay,
        peerToPeerAllowed: decision.allowPeerToPeer,
        peerToPeerToRelayFallback: decision.allowPeerToPeerToRelayFallback,
        liveToStoredFallbackAllowed: decision.allowLiveToStoredFallback,
        retainRecord: decision.retainLiveTransferRecords,
        failureReason: sessionCode,
        expiresAt: new Date(Date.now() + this.awaitingJoinTtlMs),
      },
    });

    await this.projectRetainedRecord(session.id);

    return {
      liveTransferSessionId: session.id,
      sessionCode,
      state: session.state,
      relayAllowed: session.relayAllowed,
      peerToPeerAllowed: session.peerToPeerAllowed,
      peerToPeerToRelayFallback: session.peerToPeerToRelayFallback,
      liveToStoredFallbackAllowed: session.liveToStoredFallbackAllowed,
      retainRecord: session.retainRecord,
      expiresAt: session.expiresAt,
    };
  }

  async joinSession(userId: string, trustedDeviceId: string | null, sessionCode: string) {
    if (!trustedDeviceId) {
      throw new ForbiddenException('Trusted device required');
    }

    const session = await this.getSessionByCode(sessionCode);
    this.assertJoinable(session);

    const updated = await this.prisma.liveTransferSession.update({
      where: { id: session.id },
      data: {
        joinerUserId: userId,
        joinerDeviceId: trustedDeviceId,
        state: LiveTransferSessionState.AWAITING_CONFIRMATION,
      },
    });

    await this.projectRetainedRecord(updated.id);

    return updated;
  }

  async confirmSession(userId: string, trustedDeviceId: string | null, sessionId: string, confirmed: boolean) {
    if (!trustedDeviceId) {
      throw new ForbiddenException('Trusted device required');
    }

    const session = await this.prisma.liveTransferSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Live-transfer session not found');
    }

    this.assertParticipant(session, userId, trustedDeviceId);

    if (!confirmed) {
      const cancelled = await this.prisma.liveTransferSession.update({
        where: { id: session.id },
        data: { state: LiveTransferSessionState.CANCELLED },
      });
      await this.projectRetainedRecord(cancelled.id);
      return cancelled;
    }

    const updated = await this.prisma.liveTransferSession.update({
      where: { id: session.id },
      data: {
        state: LiveTransferSessionState.CONNECTING,
        transportState: session.peerToPeerAllowed
          ? LiveTransferTransportState.P2P_ATTEMPT
          : session.relayAllowed
            ? LiveTransferTransportState.RELAY_ATTEMPT
            : null,
      },
    });

    await this.projectRetainedRecord(updated.id);
    return updated;
  }

  async updateTransport(userId: string, trustedDeviceId: string | null, sessionId: string, input: UpdateLiveTransportDto) {
    if (!trustedDeviceId) {
      throw new ForbiddenException('Trusted device required');
    }

    const session = await this.prisma.liveTransferSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Live-transfer session not found');
    }

    this.assertParticipant(session, userId, trustedDeviceId);

    if (
      (input.transportState === LiveTransferTransportState.RELAY_ATTEMPT ||
        input.transportState === LiveTransferTransportState.RELAY_ACTIVE) &&
      !session.relayAllowed
    ) {
      throw new BadRequestException('Relay transport is not allowed for this session');
    }

    if (
      input.transportState === LiveTransferTransportState.RELAY_ATTEMPT &&
      session.transportState === LiveTransferTransportState.P2P_ATTEMPT &&
      !session.peerToPeerToRelayFallback
    ) {
      throw new BadRequestException('Peer-to-peer to relay fallback is not allowed for this session');
    }

    const nextState =
      input.transportState === LiveTransferTransportState.P2P_ACTIVE ||
      input.transportState === LiveTransferTransportState.RELAY_ACTIVE
        ? LiveTransferSessionState.ACTIVE
        : LiveTransferSessionState.CONNECTING;

    const updated = await this.prisma.liveTransferSession.update({
      where: { id: session.id },
      data: {
        state: nextState,
        transportState: input.transportState,
      },
    });

    await this.projectRetainedRecord(updated.id);
    return updated;
  }

  async completeSession(userId: string, trustedDeviceId: string | null, sessionId: string) {
    if (!trustedDeviceId) {
      throw new ForbiddenException('Trusted device required');
    }

    const session = await this.prisma.liveTransferSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Live-transfer session not found');
    }

    this.assertParticipant(session, userId, trustedDeviceId);

    const updated = await this.prisma.liveTransferSession.update({
      where: { id: session.id },
      data: {
        state: LiveTransferSessionState.COMPLETED,
        completedAt: new Date(),
      },
    });

    await this.projectRetainedRecord(updated.id);
    return updated;
  }

  async failSession(userId: string, trustedDeviceId: string | null, sessionId: string, reason: string) {
    if (!trustedDeviceId) {
      throw new ForbiddenException('Trusted device required');
    }

    const session = await this.prisma.liveTransferSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Live-transfer session not found');
    }

    this.assertParticipant(session, userId, trustedDeviceId);

    const updated = await this.prisma.liveTransferSession.update({
      where: { id: session.id },
      data: {
        state: LiveTransferSessionState.FAILED,
        failureReason: reason,
      },
    });

    await this.projectRetainedRecord(updated.id);
    return updated;
  }

  async beginStoredFallback(userId: string, trustedDeviceId: string | null, sessionId: string) {
    if (!trustedDeviceId) {
      throw new ForbiddenException('Trusted device required');
    }

    const session = await this.prisma.liveTransferSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Live-transfer session not found');
    }

    this.assertParticipant(session, userId, trustedDeviceId);

    if (!session.liveToStoredFallbackAllowed) {
      throw new BadRequestException('Live-to-stored fallback is not allowed for this session');
    }

    if (session.state !== LiveTransferSessionState.FAILED && session.state !== LiveTransferSessionState.CANCELLED) {
      throw new BadRequestException('Live-to-stored fallback requires a failed or cancelled session');
    }

    return {
      liveTransferSessionId: session.id,
      handoffRequired: true,
      contentLabel: session.contentLabel,
      contentKind: session.contentKind,
      confidentialityLevel: session.confidentialityLevel,
      groupedTransfer: session.groupedTransfer,
    };
  }

  async listRetainedRecords(userId: string) {
    return this.prisma.liveTransferRecordProjection.findMany({
      where: { ownerUserId: userId },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.prisma.liveTransferSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Live-transfer session not found');
    }

    if (session.initiatorUserId !== userId && session.joinerUserId !== userId) {
      throw new NotFoundException('Live-transfer session not found');
    }

    return {
      ...session,
      sessionCode: session.failureReason,
    };
  }

  private async getSessionByCode(sessionCode: string) {
    const session = await this.prisma.liveTransferSession.findFirst({
      where: { failureReason: sessionCode },
    });

    if (!session) {
      throw new NotFoundException('Live-transfer session not found');
    }

    return session;
  }

  private assertJoinable(session: {
    state: LiveTransferSessionState;
    joinerUserId: string | null;
    expiresAt: Date;
  }) {
    if (session.expiresAt < new Date()) {
      throw new BadRequestException('Live-transfer session expired');
    }

    if (session.state !== LiveTransferSessionState.AWAITING_JOIN || session.joinerUserId) {
      throw new BadRequestException('Live-transfer session is not joinable');
    }
  }

  private assertParticipant(
    session: {
      initiatorUserId: string;
      initiatorDeviceId: string;
      joinerUserId: string | null;
      joinerDeviceId: string | null;
    },
    userId: string,
    trustedDeviceId: string,
  ) {
    const isInitiator = session.initiatorUserId === userId && session.initiatorDeviceId === trustedDeviceId;
    const isJoiner = session.joinerUserId === userId && session.joinerDeviceId === trustedDeviceId;

    if (!isInitiator && !isJoiner) {
      throw new ForbiddenException('Live-transfer participant required');
    }
  }

  private async projectRetainedRecord(sessionId: string) {
    const session = await this.prisma.liveTransferSession.findUnique({
      where: { id: sessionId },
      include: {
        initiatorUser: true,
        joinerUser: true,
      },
    });

    if (!session || !session.retainRecord) {
      return;
    }

    const records = [
      {
        ownerUserId: session.initiatorUserId,
        participantLabel: session.joinerUser?.username ?? 'pending participant',
      },
      ...(session.joinerUserId
        ? [
            {
              ownerUserId: session.joinerUserId,
              participantLabel: session.initiatorUser.username,
            },
          ]
        : []),
    ];

    for (const record of records) {
      await this.prisma.liveTransferRecordProjection.upsert({
        where: {
          ownerUserId_liveTransferSessionId: {
            ownerUserId: record.ownerUserId,
            liveTransferSessionId: session.id,
          },
        },
        update: {
          ownerUserId: record.ownerUserId,
          participantLabel: record.participantLabel,
          sessionOutcome: session.state.toLowerCase(),
          transportSummary: session.transportState?.toLowerCase() ?? null,
          contentLabel: session.contentLabel,
          contentKind: session.contentKind,
          groupedTransfer: session.groupedTransfer,
          startedAt: session.createdAt,
          endedAt: session.completedAt,
          projectedAt: new Date(),
        },
        create: {
          ownerUserId: record.ownerUserId,
          liveTransferSessionId: session.id,
          participantLabel: record.participantLabel,
          sessionOutcome: session.state.toLowerCase(),
          transportSummary: session.transportState?.toLowerCase() ?? null,
          contentLabel: session.contentLabel,
          contentKind: session.contentKind,
          groupedTransfer: session.groupedTransfer,
          startedAt: session.createdAt,
          endedAt: session.completedAt,
        },
      });
    }
  }
}
