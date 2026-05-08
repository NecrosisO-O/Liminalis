import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { SessionActor } from '../common/decorators/session.decorator';
import { AdminGuard } from '../common/guards/admin.guard';
import { SessionGuard } from '../common/guards/session.guard';
import {
  liminalisCookieClearOptions,
  liminalisCookieOptions,
  sessionCookieName,
} from '../common/security/cookies';
import { RateLimitService } from '../common/security/rate-limit.service';
import type { AuthenticatedSession } from '../common/types/auth.types';
import { BootstrapService } from './bootstrap.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { InvalidateInviteDto } from './dto/invalidate-invite.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { IdentityService } from './identity.service';
import { SessionsService } from './sessions.service';

@Controller()
export class IdentityController {
  constructor(
    private readonly identityService: IdentityService,
    private readonly sessionsService: SessionsService,
    private readonly bootstrapService: BootstrapService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  @Post('api/registration/register')
  async register(@Body() input: RegisterDto, @Req() request: Request) {
    this.rateLimitService.assertAllowed({
      scope: 'registration',
      request,
      keyParts: [input.username, input.inviteCode],
      limit: 10,
      windowMs: 15 * 60_000,
    });
    return this.identityService.register(input);
  }

  @HttpCode(200)
  @Post('api/auth/login')
  async login(
    @Body() input: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.rateLimitService.assertAllowed({
      scope: 'auth-login',
      request,
      keyParts: [input.username],
      limit: 8,
      windowMs: 15 * 60_000,
    });

    const user = await this.identityService.validateCredentials(input);
    const session = await this.sessionsService.createSession(user.id);

    response.cookie(sessionCookieName, session.token, liminalisCookieOptions());

    return {
      userId: user.id,
      username: user.username,
    };
  }

  @HttpCode(200)
  @Post('api/auth/logout')
  async logout(
    @Res({ passthrough: true }) response: Response,
    @SessionActor() sessionActor: AuthenticatedSession | null,
  ) {
    const token = this.sessionCookieFromResponse(response);
    if (token) {
      await this.sessionsService.destroySession(token);
    }

    response.clearCookie(sessionCookieName, liminalisCookieClearOptions());

    return {
      ok: true,
      sessionId: sessionActor?.sessionId ?? null,
    };
  }

  private sessionCookieFromResponse(response: Response) {
    const cookies = (
      response.req as unknown as {
        cookies?: Record<string, string | undefined>;
      }
    ).cookies;

    return cookies?.[sessionCookieName];
  }

  @UseGuards(SessionGuard)
  @Get('api/bootstrap')
  async bootstrap(@SessionActor() sessionActor: AuthenticatedSession) {
    return this.bootstrapService.getBootstrapState(
      sessionActor.userId,
      sessionActor.trustedDeviceId,
    );
  }

  @UseGuards(SessionGuard, AdminGuard)
  @Get('api/admin/pending-users')
  async listPendingUsers() {
    return this.identityService.listPendingUsers();
  }

  @UseGuards(SessionGuard, AdminGuard)
  @Get('api/admin/invites')
  async listInvites() {
    return this.identityService.listInvites();
  }

  @UseGuards(SessionGuard, AdminGuard)
  @Post('api/admin/invites')
  async createInvite(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Body() input: CreateInviteDto,
  ) {
    return this.identityService.createInvite(
      sessionActor.userId,
      input.expiresInMinutes,
    );
  }

  @UseGuards(SessionGuard, AdminGuard)
  @Post('api/admin/invites/invalidate')
  async invalidateInvite(@Body() input: InvalidateInviteDto) {
    return this.identityService.invalidateInvite(input.inviteId);
  }
}
