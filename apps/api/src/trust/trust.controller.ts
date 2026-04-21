import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SessionActor } from '../common/decorators/session.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import type { AuthenticatedSession } from '../common/types/auth.types';
import { ApprovePairingDto } from './dto/approve-pairing.dto';
import { CreatePairingSessionDto } from './dto/create-pairing-session.dto';
import { FirstDeviceBootstrapDto } from './dto/first-device-bootstrap.dto';
import { RecoveryAttemptDto } from './dto/recovery-attempt.dto';
import { RejectPairingDto } from './dto/reject-pairing.dto';
import { TrustService } from './trust.service';

@Controller('api')
export class TrustController {
  constructor(private readonly trustService: TrustService) {}

  @UseGuards(SessionGuard)
  @Post('trust/bootstrap-first-device')
  async bootstrapFirstDevice(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Body() input: FirstDeviceBootstrapDto,
  ) {
    return this.trustService.bootstrapFirstDevice(sessionActor.userId, input);
  }

  @UseGuards(SessionGuard)
  @Post('trust/pairing-sessions')
  async createPairingSession(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Body() input: CreatePairingSessionDto,
  ) {
    return this.trustService.createPairingSession(sessionActor.userId, input);
  }

  @UseGuards(SessionGuard)
  @Get('trust/pairing-sessions/:pairingSessionId')
  async getPairingSession(@Param('pairingSessionId') pairingSessionId: string) {
    return this.trustService.getPairingSession(pairingSessionId);
  }

  @UseGuards(SessionGuard)
  @Post('trust/pairing/approve')
  async approvePairing(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Body() input: ApprovePairingDto,
  ) {
    return this.trustService.approvePairing(sessionActor.userId, input);
  }

  @UseGuards(SessionGuard)
  @Post('trust/pairing/reject')
  async rejectPairing(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Body() input: RejectPairingDto,
  ) {
    return this.trustService.rejectPairing(sessionActor.userId, input);
  }

  @UseGuards(SessionGuard)
  @Get('trust/pairing/by-short-code/:shortCode')
  async pairingByShortCode(@Param('shortCode') shortCode: string) {
    return this.trustService.resolvePairingByShortCode(shortCode);
  }

  @UseGuards(SessionGuard)
  @Get('trust/pairing/by-qr/:qrToken')
  async pairingByQrToken(@Param('qrToken') qrToken: string) {
    return this.trustService.resolvePairingByQrToken(qrToken);
  }

  @UseGuards(SessionGuard)
  @Post('recovery/attempt')
  async recoveryAttempt(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Body() input: RecoveryAttemptDto,
  ) {
    return this.trustService.recoveryAttempt(sessionActor.userId, input);
  }

  @UseGuards(SessionGuard)
  @Get('recovery/pending-display')
  async pendingRecoveryDisplay(@SessionActor() sessionActor: AuthenticatedSession) {
    return this.trustService.getPendingRecoveryDisplay(sessionActor.userId);
  }

  @UseGuards(SessionGuard)
  @Post('recovery/acknowledge/:trustedDeviceId')
  async acknowledgeRecovery(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Param('trustedDeviceId') trustedDeviceId: string,
  ) {
    return this.trustService.acknowledgeRecoveryRotation(
      sessionActor.userId,
      trustedDeviceId,
    );
  }
}
