import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SessionActor } from '../common/decorators/session.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import type { AuthenticatedSession } from '../common/types/auth.types';
import { ConfirmLiveTransferDto } from './dto/confirm-live-transfer.dto';
import { CreateLiveTransferDto } from './dto/create-live-transfer.dto';
import { JoinLiveTransferDto } from './dto/join-live-transfer.dto';
import { UpdateLiveTransportDto } from './dto/update-live-transport.dto';
import { LiveTransferService } from './live-transfer.service';

@Controller('api/live-transfer')
@UseGuards(SessionGuard)
export class LiveTransferController {
  constructor(private readonly liveTransferService: LiveTransferService) {}

  @Post('sessions')
  async createSession(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Body() input: CreateLiveTransferDto,
  ) {
    return this.liveTransferService.createSession(
      sessionActor.userId,
      sessionActor.trustedDeviceId,
      input,
    );
  }

  @Post('sessions/join')
  async joinSession(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Body() input: JoinLiveTransferDto,
  ) {
    return this.liveTransferService.joinSession(
      sessionActor.userId,
      sessionActor.trustedDeviceId,
      input.sessionCode,
    );
  }

  @Post('sessions/:sessionId/confirm')
  async confirmSession(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Param('sessionId') sessionId: string,
    @Body() input: ConfirmLiveTransferDto,
  ) {
    return this.liveTransferService.confirmSession(
      sessionActor.userId,
      sessionActor.trustedDeviceId,
      sessionId,
      input.confirmed,
    );
  }

  @Post('sessions/:sessionId/transport')
  async updateTransport(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Param('sessionId') sessionId: string,
    @Body() input: UpdateLiveTransportDto,
  ) {
    return this.liveTransferService.updateTransport(
      sessionActor.userId,
      sessionActor.trustedDeviceId,
      sessionId,
      input,
    );
  }

  @Post('sessions/:sessionId/complete')
  async completeSession(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Param('sessionId') sessionId: string,
  ) {
    return this.liveTransferService.completeSession(
      sessionActor.userId,
      sessionActor.trustedDeviceId,
      sessionId,
    );
  }

  @Post('sessions/:sessionId/fail')
  async failSession(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Param('sessionId') sessionId: string,
    @Body() input: { reason: string },
  ) {
    return this.liveTransferService.failSession(
      sessionActor.userId,
      sessionActor.trustedDeviceId,
      sessionId,
      input.reason,
    );
  }

  @Post('sessions/:sessionId/stored-fallback')
  async beginStoredFallback(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Param('sessionId') sessionId: string,
  ) {
    return this.liveTransferService.beginStoredFallback(
      sessionActor.userId,
      sessionActor.trustedDeviceId,
      sessionId,
    );
  }

  @Get('sessions/:sessionId')
  async getSession(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Param('sessionId') sessionId: string,
  ) {
    return this.liveTransferService.getSession(sessionActor.userId, sessionId);
  }

  @Get('records')
  async listRecords(@SessionActor() sessionActor: AuthenticatedSession) {
    return this.liveTransferService.listRetainedRecords(sessionActor.userId);
  }
}
