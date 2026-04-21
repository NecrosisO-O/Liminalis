import { Body, Controller, Post, UseGuards } from '@nestjs/common';
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

  @Post('approve')
  async approve(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Body() input: ApproveUserDto,
  ) {
    return this.identityService.approveUser(input.userId, sessionActor.userId);
  }

  @Post('disable')
  async disable(@Body() input: ToggleUserDto) {
    return this.identityService.disableUser(input.userId);
  }

  @Post('enable')
  async enable(@Body() input: ToggleUserDto) {
    return this.identityService.enableUser(input.userId);
  }
}
