import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { SessionActor } from '../common/decorators/session.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import type { AuthenticatedSession } from '../common/types/auth.types';
import { BootstrapService } from './bootstrap.service';
import { CreateInviteDto } from './dto/create-invite.dto';
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
  ) {}

  @Post('api/registration/register')
  async register(@Body() input: RegisterDto) {
    return this.identityService.register(input);
  }

  @HttpCode(200)
  @Post('api/auth/login')
  async login(@Body() input: LoginDto, @Res({ passthrough: true }) response: Response) {
    const user = await this.identityService.validateCredentials(input);
    const session = await this.sessionsService.createSession(user.id);

    response.cookie('liminalis_session', session.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
    });

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
    const token = response.req?.cookies?.liminalis_session;
    if (token) {
      await this.sessionsService.destroySession(token);
    }

    response.clearCookie('liminalis_session');

    return {
      ok: true,
      sessionId: sessionActor?.sessionId ?? null,
    };
  }

  @UseGuards(SessionGuard)
  @Get('api/bootstrap')
  async bootstrap(@SessionActor() sessionActor: AuthenticatedSession) {
    return this.bootstrapService.getBootstrapState(sessionActor.userId);
  }

  @UseGuards(SessionGuard)
  @Get('api/admin/pending-users')
  async listPendingUsers(@SessionActor() sessionActor: AuthenticatedSession) {
    this.identityService.requireAdmin(sessionActor.role);
    return this.identityService.listPendingUsers();
  }

  @UseGuards(SessionGuard)
  @Post('api/admin/invites')
  async createInvite(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Body() input: CreateInviteDto,
  ) {
    this.identityService.requireAdmin(sessionActor.role);
    return this.identityService.createInvite(sessionActor.userId, input.expiresInMinutes);
  }
}
