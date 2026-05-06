import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Readable } from 'stream';
import { Prisma } from '../../generated/prisma/index.js';
import {
  LiveTransferSessionState,
  LiveTransferTransportState,
  type UploadContentKind,
} from '../../generated/prisma/index.js';
import { PolicyService } from '../policy/policy.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UploadsService } from '../uploads/uploads.service';
import { CreateLiveTransferDto } from './dto/create-live-transfer.dto';
import { UpdateLiveTransportDto } from './dto/update-live-transport.dto';

@Injectable()
export class LiveTransferService {
  private readonly awaitingJoinTtlMs = 5 * 60 * 1000;
  private readonly liveTransferLabel = 'Encrypted live transfer';
  private readonly groupedLiveTransferLabel = 'Encrypted grouped live transfer';

  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
    private readonly storageService: StorageService,
    private readonly uploadsService: UploadsService,
  ) {}

  async createSession(
    userId: string,
    trustedDeviceId: string | null,
    input: CreateLiveTransferDto,
  ) {
    if (!trustedDeviceId) {
      throw new ForbiddenException('Trusted device required');
    }

    const confidentialityLevel =
      input.confidentialityLevel ??
      (await this.policyService.getDefaultConfidentialityLevel());

    const decision = await this.policyService.evaluateLiveTransferCreation({
      confidentialityLevel,
      groupedTransfer: input.groupedTransfer ?? false,
      contentKind: input.contentKind,
    });

    const sessionCode = crypto.randomUUID().slice(0, 8).toUpperCase();

    const session = await this.prisma.liveTransferSession.create({
      data: {
        initiatorUserId: userId,
        initiatorDeviceId: trustedDeviceId,
        confidentialityLevel,
        policyBundleId: decision.policyBundle.id,
        policySnapshot: decision.snapshotFieldsToPersist,
        state: LiveTransferSessionState.AWAITING_JOIN,
        contentLabel: this.safeContentLabel(
          input.contentKind,
          input.groupedTransfer ?? false,
        ),
        contentKind: input.contentKind,
        groupedTransfer: input.groupedTransfer ?? false,
        relayAllowed: decision.allowRelay,
        peerToPeerAllowed: decision.allowPeerToPeer,
        peerToPeerToRelayFallback: decision.allowPeerToPeerToRelayFallback,
        liveToStoredFallbackAllowed: decision.allowLiveToStoredFallback,
        retainRecord: decision.retainLiveTransferRecords,
        sessionCode,
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

  async joinSession(
    userId: string,
    trustedDeviceId: string | null,
    sessionCode: string,
  ) {
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

  async confirmSession(
    userId: string,
    trustedDeviceId: string | null,
    sessionId: string,
    confirmed: boolean,
  ) {
    if (!trustedDeviceId) {
      throw new ForbiddenException('Trusted device required');
    }

    const session = await this.prisma.liveTransferSession.findUnique({
      where: { id: sessionId },
    });
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

    if (session.state !== LiveTransferSessionState.AWAITING_CONFIRMATION) {
      throw new BadRequestException(
        'Live-transfer session is not awaiting confirmation',
      );
    }

    if (!session.joinerUserId || !session.joinerDeviceId) {
      throw new BadRequestException(
        'Live-transfer session has no joined participant',
      );
    }

    const isInitiator =
      session.initiatorUserId === userId &&
      session.initiatorDeviceId === trustedDeviceId;
    const confirmationPatch = isInitiator
      ? { initiatorConfirmedAt: new Date() }
      : { joinerConfirmedAt: new Date() };
    const initiatorConfirmedAt = isInitiator
      ? confirmationPatch.initiatorConfirmedAt
      : session.initiatorConfirmedAt;
    const joinerConfirmedAt = isInitiator
      ? session.joinerConfirmedAt
      : confirmationPatch.joinerConfirmedAt;
    const bothConfirmed = Boolean(initiatorConfirmedAt && joinerConfirmedAt);

    const updated = await this.prisma.liveTransferSession.update({
      where: { id: session.id },
      data: {
        ...confirmationPatch,
        state: bothConfirmed
          ? LiveTransferSessionState.CONNECTING
          : LiveTransferSessionState.AWAITING_CONFIRMATION,
        transportState: bothConfirmed
          ? session.peerToPeerAllowed
            ? LiveTransferTransportState.P2P_ATTEMPT
            : session.relayAllowed
              ? LiveTransferTransportState.RELAY_ATTEMPT
              : null
          : session.transportState,
      },
    });

    await this.projectRetainedRecord(updated.id);
    return updated;
  }

  async updateTransport(
    userId: string,
    trustedDeviceId: string | null,
    sessionId: string,
    input: UpdateLiveTransportDto,
  ) {
    if (!trustedDeviceId) {
      throw new ForbiddenException('Trusted device required');
    }

    const session = await this.prisma.liveTransferSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException('Live-transfer session not found');
    }

    this.assertParticipant(session, userId, trustedDeviceId);
    this.assertTransportMutable(session);

    if (
      (input.transportState === LiveTransferTransportState.P2P_ATTEMPT ||
        input.transportState === LiveTransferTransportState.P2P_ACTIVE) &&
      !session.peerToPeerAllowed
    ) {
      throw new BadRequestException(
        'Peer-to-peer transport is not allowed for this session',
      );
    }

    if (
      (input.transportState === LiveTransferTransportState.RELAY_ATTEMPT ||
        input.transportState === LiveTransferTransportState.RELAY_ACTIVE) &&
      !session.relayAllowed
    ) {
      throw new BadRequestException(
        'Relay transport is not allowed for this session',
      );
    }

    if (
      (input.transportState === LiveTransferTransportState.RELAY_ATTEMPT ||
        input.transportState === LiveTransferTransportState.RELAY_ACTIVE) &&
      session.transportState === LiveTransferTransportState.P2P_ATTEMPT &&
      !session.peerToPeerToRelayFallback
    ) {
      throw new BadRequestException(
        'Peer-to-peer to relay fallback is not allowed for this session',
      );
    }

    if (
      input.transportState === LiveTransferTransportState.RELAY_ACTIVE &&
      session.transportState !== LiveTransferTransportState.RELAY_ATTEMPT
    ) {
      throw new BadRequestException(
        'Relay transport must be attempted before activation',
      );
    }

    if (
      input.transportState === LiveTransferTransportState.P2P_ACTIVE &&
      session.transportState !== LiveTransferTransportState.P2P_ATTEMPT
    ) {
      throw new BadRequestException(
        'Peer-to-peer transport must be attempted before activation',
      );
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

  async completeSession(
    userId: string,
    trustedDeviceId: string | null,
    sessionId: string,
  ) {
    if (!trustedDeviceId) {
      throw new ForbiddenException('Trusted device required');
    }

    const session = await this.prisma.liveTransferSession.findUnique({
      where: { id: sessionId },
    });
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

  async failSession(
    userId: string,
    trustedDeviceId: string | null,
    sessionId: string,
    reason: string,
  ) {
    if (!trustedDeviceId) {
      throw new ForbiddenException('Trusted device required');
    }

    const session = await this.prisma.liveTransferSession.findUnique({
      where: { id: sessionId },
    });
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

  async beginStoredFallback(
    userId: string,
    trustedDeviceId: string | null,
    sessionId: string,
  ) {
    if (!trustedDeviceId) {
      throw new ForbiddenException('Trusted device required');
    }

    const session = await this.prisma.liveTransferSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException('Live-transfer session not found');
    }

    this.assertParticipant(session, userId, trustedDeviceId);

    if (!session.liveToStoredFallbackAllowed) {
      throw new BadRequestException(
        'Live-to-stored fallback is not allowed for this session',
      );
    }

    if (
      session.state !== LiveTransferSessionState.FAILED &&
      session.state !== LiveTransferSessionState.CANCELLED
    ) {
      throw new BadRequestException(
        'Live-to-stored fallback requires a failed or cancelled session',
      );
    }

    if (session.storedFallbackUploadSessionId) {
      const existingUploadSession = await this.prisma.uploadSession.findUnique({
        where: { id: session.storedFallbackUploadSessionId },
      });

      return {
        liveTransferSessionId: session.id,
        uploadSessionId: session.storedFallbackUploadSessionId,
        contentLabel: this.safeContentLabel(
          session.contentKind,
          session.groupedTransfer,
        ),
        contentKind: session.contentKind,
        confidentialityLevel: session.confidentialityLevel,
        groupedTransfer: session.groupedTransfer,
        expiresAt: existingUploadSession?.expiresAt ?? null,
        policySnapshot: existingUploadSession?.policySnapshot ?? null,
      };
    }

    const uploadSession = await this.uploadsService.prepareUpload(
      userId,
      trustedDeviceId,
      {
        contentKind: session.contentKind,
        groupStructureKind: session.groupedTransfer ? 'MULTI_FILE' : undefined,
        confidentialityLevel: session.confidentialityLevel,
        displayName: this.safeContentLabel(
          session.contentKind,
          session.groupedTransfer,
        ),
      },
    );

    await this.prisma.liveTransferSession.update({
      where: { id: session.id },
      data: { storedFallbackUploadSessionId: uploadSession.uploadSessionId },
    });

    return {
      liveTransferSessionId: session.id,
      uploadSessionId: uploadSession.uploadSessionId,
      contentLabel: this.safeContentLabel(
        session.contentKind,
        session.groupedTransfer,
      ),
      contentKind: session.contentKind,
      confidentialityLevel: session.confidentialityLevel,
      groupedTransfer: session.groupedTransfer,
      expiresAt: uploadSession.expiresAt,
      policySnapshot: uploadSession.policySnapshot,
    };
  }

  async sendSignal(
    userId: string,
    trustedDeviceId: string | null,
    sessionId: string,
    input: { kind: string; payload: Record<string, unknown> },
  ) {
    if (!trustedDeviceId) {
      throw new ForbiddenException('Trusted device required');
    }

    const session = await this.prisma.liveTransferSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException('Live-transfer session not found');
    }

    this.assertParticipant(session, userId, trustedDeviceId);
    this.assertCanExchangeTransportData(session);

    const counterpart = this.resolveCounterpart(
      session,
      userId,
      trustedDeviceId,
    );

    return this.prisma.liveTransferSignalMessage.create({
      data: {
        sessionId: session.id,
        senderUserId: userId,
        senderDeviceId: trustedDeviceId,
        recipientUserId: counterpart.userId,
        recipientDeviceId: counterpart.deviceId,
        kind: input.kind,
        payload: input.payload as Prisma.InputJsonValue,
      },
    });
  }

  async listSignals(
    userId: string,
    trustedDeviceId: string | null,
    sessionId: string,
  ) {
    if (!trustedDeviceId) {
      throw new ForbiddenException('Trusted device required');
    }

    const session = await this.prisma.liveTransferSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException('Live-transfer session not found');
    }

    this.assertParticipant(session, userId, trustedDeviceId);

    const messages = await this.prisma.liveTransferSignalMessage.findMany({
      where: {
        sessionId: session.id,
        recipientUserId: userId,
        recipientDeviceId: trustedDeviceId,
        readAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (messages.length > 0) {
      await this.prisma.liveTransferSignalMessage.updateMany({
        where: { id: { in: messages.map((message) => message.id) } },
        data: { readAt: new Date() },
      });
    }

    return messages;
  }

  async uploadRelayChunk(
    userId: string,
    trustedDeviceId: string | null,
    sessionId: string,
    sequence: number,
    body: Readable,
  ) {
    if (!trustedDeviceId) {
      throw new ForbiddenException('Trusted device required');
    }

    if (sequence < 1 || !Number.isInteger(sequence)) {
      throw new BadRequestException(
        'Relay chunk sequence must be a positive integer',
      );
    }

    const session = await this.prisma.liveTransferSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException('Live-transfer session not found');
    }

    this.assertParticipant(session, userId, trustedDeviceId);
    this.assertRelayActive(session);
    const counterpart = this.resolveCounterpart(
      session,
      userId,
      trustedDeviceId,
    );
    const previousChunk = await this.prisma.liveTransferRelayChunk.findUnique({
      where: {
        sessionId_senderDeviceId_sequence: {
          sessionId: session.id,
          senderDeviceId: trustedDeviceId,
          sequence,
        },
      },
      select: { storageKey: true },
    });
    const stored = await this.storageService.writeLiveTransferRelayChunk({
      sessionId: session.id,
      senderDeviceId: trustedDeviceId,
      sequence,
      body,
    });

    const relayChunk = await this.prisma.liveTransferRelayChunk.upsert({
      where: {
        sessionId_senderDeviceId_sequence: {
          sessionId: session.id,
          senderDeviceId: trustedDeviceId,
          sequence,
        },
      },
      update: {
        recipientDeviceId: counterpart.deviceId,
        storageKey: stored.storageKey,
        byteSize: stored.byteSize,
        checksum: stored.checksum,
        receivedAt: null,
      },
      create: {
        sessionId: session.id,
        senderDeviceId: trustedDeviceId,
        recipientDeviceId: counterpart.deviceId,
        sequence,
        storageKey: stored.storageKey,
        byteSize: stored.byteSize,
        checksum: stored.checksum,
      },
    });

    if (previousChunk && previousChunk.storageKey !== stored.storageKey) {
      await this.storageService.remove(previousChunk.storageKey);
    }

    return relayChunk;
  }

  async listRelayChunks(
    userId: string,
    trustedDeviceId: string | null,
    sessionId: string,
  ) {
    if (!trustedDeviceId) {
      throw new ForbiddenException('Trusted device required');
    }

    const session = await this.prisma.liveTransferSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException('Live-transfer session not found');
    }

    this.assertParticipant(session, userId, trustedDeviceId);
    this.assertRelayActive(session, { allowCompleted: true });

    return this.prisma.liveTransferRelayChunk.findMany({
      where: {
        sessionId: session.id,
        recipientDeviceId: trustedDeviceId,
        receivedAt: null,
      },
      orderBy: { sequence: 'asc' },
      select: {
        id: true,
        senderDeviceId: true,
        sequence: true,
        byteSize: true,
        checksum: true,
        createdAt: true,
      },
    });
  }

  async createRelayChunkReadStream(
    userId: string,
    trustedDeviceId: string | null,
    sessionId: string,
    chunkId: string,
  ) {
    if (!trustedDeviceId) {
      throw new ForbiddenException('Trusted device required');
    }

    const session = await this.prisma.liveTransferSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException('Live-transfer session not found');
    }

    this.assertParticipant(session, userId, trustedDeviceId);
    this.assertRelayActive(session, { allowCompleted: true });

    const chunk = await this.prisma.liveTransferRelayChunk.findFirst({
      where: {
        id: chunkId,
        sessionId: session.id,
        recipientDeviceId: trustedDeviceId,
      },
    });

    if (!chunk) {
      throw new NotFoundException('Relay chunk not found');
    }

    return {
      stream: this.storageService.createReadStream(chunk.storageKey),
      contentLength: chunk.byteSize,
      sequence: chunk.sequence,
    };
  }

  async acknowledgeRelayChunk(
    userId: string,
    trustedDeviceId: string | null,
    sessionId: string,
    chunkId: string,
  ) {
    if (!trustedDeviceId) {
      throw new ForbiddenException('Trusted device required');
    }

    const session = await this.prisma.liveTransferSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException('Live-transfer session not found');
    }

    this.assertParticipant(session, userId, trustedDeviceId);
    this.assertRelayActive(session, { allowCompleted: true });

    const chunk = await this.prisma.liveTransferRelayChunk.findFirst({
      where: {
        id: chunkId,
        sessionId: session.id,
        recipientDeviceId: trustedDeviceId,
      },
    });

    if (!chunk) {
      throw new NotFoundException('Relay chunk not found');
    }

    return this.prisma.liveTransferRelayChunk.update({
      where: { id: chunk.id },
      data: { receivedAt: new Date() },
    });
  }

  async listRetainedRecords(userId: string) {
    return this.prisma.liveTransferRecordProjection.findMany({
      where: { ownerUserId: userId },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.prisma.liveTransferSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException('Live-transfer session not found');
    }

    if (session.initiatorUserId !== userId && session.joinerUserId !== userId) {
      throw new NotFoundException('Live-transfer session not found');
    }

    return {
      ...session,
      sessionCode: session.sessionCode,
    };
  }

  private async getSessionByCode(sessionCode: string) {
    const normalizedSessionCode = sessionCode.trim().toUpperCase();
    const session =
      (await this.prisma.liveTransferSession.findUnique({
        where: { sessionCode: normalizedSessionCode },
      })) ??
      (await this.prisma.liveTransferSession.findUnique({
        where: { sessionCode: normalizedSessionCode.toLowerCase() },
      }));

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

    if (
      session.state !== LiveTransferSessionState.AWAITING_JOIN ||
      session.joinerUserId
    ) {
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
    const isInitiator =
      session.initiatorUserId === userId &&
      session.initiatorDeviceId === trustedDeviceId;
    const isJoiner =
      session.joinerUserId === userId &&
      session.joinerDeviceId === trustedDeviceId;

    if (!isInitiator && !isJoiner) {
      throw new ForbiddenException('Live-transfer participant required');
    }
  }

  private assertTransportMutable(session: {
    state: LiveTransferSessionState;
    initiatorConfirmedAt: Date | null;
    joinerConfirmedAt: Date | null;
  }) {
    if (
      session.state !== LiveTransferSessionState.CONNECTING &&
      session.state !== LiveTransferSessionState.ACTIVE
    ) {
      throw new BadRequestException(
        'Live-transfer transport is not active yet',
      );
    }

    if (!session.initiatorConfirmedAt || !session.joinerConfirmedAt) {
      throw new BadRequestException(
        'Live-transfer requires both-side confirmation',
      );
    }
  }

  private assertCanExchangeTransportData(
    session: {
      state: LiveTransferSessionState;
      initiatorConfirmedAt: Date | null;
      joinerConfirmedAt: Date | null;
      joinerUserId: string | null;
      joinerDeviceId: string | null;
    },
    options: { allowCompleted?: boolean } = {},
  ) {
    if (!session.joinerUserId || !session.joinerDeviceId) {
      throw new BadRequestException(
        'Live-transfer session has no joined participant',
      );
    }

    if (!session.initiatorConfirmedAt || !session.joinerConfirmedAt) {
      throw new BadRequestException(
        'Live-transfer requires both-side confirmation',
      );
    }

    const stateAllowsExchange =
      session.state === LiveTransferSessionState.CONNECTING ||
      session.state === LiveTransferSessionState.ACTIVE ||
      (options.allowCompleted &&
        session.state === LiveTransferSessionState.COMPLETED);

    if (!stateAllowsExchange) {
      throw new BadRequestException(
        'Live-transfer session is not ready for signaling',
      );
    }
  }

  private assertRelayActive(
    session: {
      relayAllowed: boolean;
      transportState: LiveTransferTransportState | null;
      state: LiveTransferSessionState;
      initiatorConfirmedAt: Date | null;
      joinerConfirmedAt: Date | null;
      joinerUserId: string | null;
      joinerDeviceId: string | null;
    },
    options: { allowCompleted?: boolean } = {},
  ) {
    this.assertCanExchangeTransportData(session, options);

    if (!session.relayAllowed) {
      throw new BadRequestException(
        'Relay transport is not allowed for this session',
      );
    }

    if (session.transportState !== LiveTransferTransportState.RELAY_ACTIVE) {
      throw new BadRequestException('Relay transport is not active');
    }
  }

  private resolveCounterpart(
    session: {
      initiatorUserId: string;
      initiatorDeviceId: string;
      joinerUserId: string | null;
      joinerDeviceId: string | null;
    },
    userId: string,
    trustedDeviceId: string,
  ) {
    if (!session.joinerUserId || !session.joinerDeviceId) {
      throw new BadRequestException(
        'Live-transfer session has no joined participant',
      );
    }

    if (
      session.initiatorUserId === userId &&
      session.initiatorDeviceId === trustedDeviceId
    ) {
      return {
        userId: session.joinerUserId,
        deviceId: session.joinerDeviceId,
      };
    }

    if (
      session.joinerUserId === userId &&
      session.joinerDeviceId === trustedDeviceId
    ) {
      return {
        userId: session.initiatorUserId,
        deviceId: session.initiatorDeviceId,
      };
    }

    throw new ForbiddenException('Live-transfer participant required');
  }

  private safeContentLabel(
    contentKind: UploadContentKind,
    groupedTransfer: boolean,
  ) {
    if (groupedTransfer || contentKind === 'GROUPED_CONTENT') {
      return this.groupedLiveTransferLabel;
    }

    return this.liveTransferLabel;
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

    const contentLabel = this.safeContentLabel(
      session.contentKind,
      session.groupedTransfer,
    );

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
          contentLabel,
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
          contentLabel,
          contentKind: session.contentKind,
          groupedTransfer: session.groupedTransfer,
          startedAt: session.createdAt,
          endedAt: session.completedAt,
        },
      });
    }
  }
}
