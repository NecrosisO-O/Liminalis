import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SessionActor } from '../common/decorators/session.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import type { AuthenticatedSession } from '../common/types/auth.types';
import { ApproveUserDto } from './dto/approve-user.dto';
import { ToggleUserDto } from './dto/toggle-user.dto';
import { IdentityService } from './identity.service';

@Controller('api/admin/users')
@UseGuards(SessionGuard)
export class AdminUsersController {
  constructor(private readonly identityService: IdentityService) {}

  @Get()
  async listUsers(@SessionActor() sessionActor: AuthenticatedSession) {
    this.identityService.requireAdmin(sessionActor.role);
    return this.identityService.listUsers();
  }

  @Post('approve')
  async approve(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Body() input: ApproveUserDto,
  ) {
    this.identityService.requireAdmin(sessionActor.role);
    return this.identityService.approveUser(input.userId, sessionActor.userId);
  }

  @Post('disable')
  async disable(@SessionActor() sessionActor: AuthenticatedSession, @Body() input: ToggleUserDto) {
    this.identityService.requireAdmin(sessionActor.role);
    return this.identityService.disableUser(input.userId);
  }

  @Post('enable')
  async enable(@SessionActor() sessionActor: AuthenticatedSession, @Body() input: ToggleUserDto) {
    this.identityService.requireAdmin(sessionActor.role);
    return this.identityService.enableUser(input.userId);
  }
}
