import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { SessionActor } from '../common/decorators/session.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import { TrustedDeviceGuard } from '../common/guards/trusted-device.guard';
import {
  liminalisCookieClearOptions,
  trustedDeviceCookieName,
} from '../common/security/cookies';
import type { AuthenticatedSession } from '../common/types/auth.types';
import { RegrantAccessDto } from './dto/regrant-access.dto';
import { MaintenanceService } from './maintenance.service';

@Controller('api/maintenance')
@UseGuards(SessionGuard, TrustedDeviceGuard)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post('trusted-access/remove')
  async removeTrustedAccess(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.maintenanceService.removeTrustedAccess(
      sessionActor.userId,
      sessionActor.trustedDeviceId,
    );

    response.clearCookie(
      trustedDeviceCookieName,
      liminalisCookieClearOptions(),
    );
    return result;
  }

  @Post('regrant')
  async regrantAccess(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Body() input: RegrantAccessDto,
  ) {
    return this.maintenanceService.regrantSnapshotAccess(
      sessionActor.userId,
      input,
    );
  }
}
