import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { SessionActor } from '../common/decorators/session.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import type { AuthenticatedSession } from '../common/types/auth.types';
import { ApprovePairingDto } from './dto/approve-pairing.dto';
import { CompleteTrustedDeviceResumeDto } from './dto/complete-trusted-device-resume.dto';
import { CreatePairingSessionDto } from './dto/create-pairing-session.dto';
import { CreateTrustedDeviceResumeChallengeDto } from './dto/create-trusted-device-resume-challenge.dto';
import { FirstDeviceBootstrapDto } from './dto/first-device-bootstrap.dto';
import { FinalizePairingDto } from './dto/finalize-pairing.dto';
import { RecoveryAttemptDto } from './dto/recovery-attempt.dto';
import { RejectPairingDto } from './dto/reject-pairing.dto';
import { TrustService } from './trust.service';

@Controller('api')
export class TrustController {
  constructor(private readonly trustService: TrustService) {}

  private setTrustedDeviceCookie(response: Response, trustedDeviceId: string) {
    response.cookie('liminalis_trusted_device', trustedDeviceId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
    });
  }

  @UseGuards(SessionGuard)
  @Post('trust/bootstrap-first-device')
  async bootstrapFirstDevice(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Body() input: FirstDeviceBootstrapDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.trustService.bootstrapFirstDevice(
      sessionActor.userId,
      input,
    );

    this.setTrustedDeviceCookie(response, result.trustedDeviceId);

    return result;
  }

  @UseGuards(SessionGuard)
  @Post('trust/pairing-sessions')
  async createPairingSession(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Body() input: CreatePairingSessionDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.trustService.createPairingSession(
      sessionActor.userId,
      input,
    );

    this.setTrustedDeviceCookie(response, result.requesterDeviceId);

    return result;
  }

  @UseGuards(SessionGuard)
  @Post('trust/resume-challenge')
  async createTrustedDeviceResumeChallenge(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Body() input: CreateTrustedDeviceResumeChallengeDto,
  ) {
    return this.trustService.createTrustedDeviceResumeChallenge(
      sessionActor.userId,
      sessionActor.sessionId,
      input,
    );
  }

  @UseGuards(SessionGuard)
  @Post('trust/resume')
  async completeTrustedDeviceResume(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Body() input: CompleteTrustedDeviceResumeDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.trustService.completeTrustedDeviceResume(
      sessionActor.userId,
      sessionActor.sessionId,
      input,
    );

    this.setTrustedDeviceCookie(response, result.trustedDeviceId);

    return result;
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
    return this.trustService.approvePairing(
      sessionActor.userId,
      sessionActor.trustedDeviceId,
      input,
    );
  }

  @UseGuards(SessionGuard)
  @Post('trust/pairing/reject')
  async rejectPairing(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Body() input: RejectPairingDto,
  ) {
    return this.trustService.rejectPairing(
      sessionActor.userId,
      sessionActor.trustedDeviceId,
      input,
    );
  }

  @UseGuards(SessionGuard)
  @Post('trust/pairing/finalize')
  async finalizePairing(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Body() input: FinalizePairingDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.trustService.finalizePairing(
      sessionActor.userId,
      input,
    );

    this.setTrustedDeviceCookie(response, result.requesterDeviceId);

    return result;
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
  async pendingRecoveryDisplay(
    @SessionActor() sessionActor: AuthenticatedSession,
  ) {
    return this.trustService.getPendingRecoveryDisplay(sessionActor.userId);
  }

  @UseGuards(SessionGuard)
  @Post('recovery/acknowledge/:trustedDeviceId')
  async acknowledgeRecovery(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Param('trustedDeviceId') trustedDeviceId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.trustService.acknowledgeRecoveryRotation(
      sessionActor.userId,
      trustedDeviceId,
    );

    this.setTrustedDeviceCookie(response, trustedDeviceId);

    return result;
  }
}
