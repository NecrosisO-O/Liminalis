import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ConfidentialityLevel } from '../../generated/prisma/index.js';
import { SessionActor } from '../common/decorators/session.decorator';
import { AdminGuard } from '../common/guards/admin.guard';
import { SessionGuard } from '../common/guards/session.guard';
import type { AuthenticatedSession } from '../common/types/auth.types';
import { PolicyService } from '../policy/policy.service';
import { PublishPolicyBundleDto } from '../policy/dto/publish-policy-bundle.dto';
import { RestoreDefaultsDto } from '../policy/dto/restore-defaults.dto';

@Controller('api/admin/policy')
@UseGuards(SessionGuard, AdminGuard)
export class AdminPolicyController {
  constructor(private readonly policyService: PolicyService) {}

  @Get()
  async getPolicyAdminState() {
    return this.policyService.getPolicyAdminState();
  }

  @Get('history/:levelName')
  async getPolicyHistory(@Param('levelName') levelName: ConfidentialityLevel) {
    return this.policyService.listBundleHistory(levelName);
  }

  @Post('publish')
  async publishPolicy(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Body() input: PublishPolicyBundleDto,
  ) {
    return this.policyService.publishBundle(sessionActor.userId, input.levelName, {
      lifecycle: input.lifecycle.value,
      shareAvailability: input.shareAvailability.value,
      userTargetedSharing: input.userTargetedSharing.value,
      passwordExtraction: input.passwordExtraction.value,
      publicLinks: input.publicLinks.value,
      liveTransfer: input.liveTransfer.value,
      defaultConfidentialityLevel: input.defaultConfidentialityLevel,
    });
  }

  @Post('restore-defaults')
  async restoreDefaults(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Body() input: RestoreDefaultsDto,
  ) {
    return this.policyService.restoreDefaults(
      sessionActor.userId,
      input.defaultConfidentialityLevel,
    );
  }
}
