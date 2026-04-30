import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SessionActor } from '../common/decorators/session.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import { TrustedDeviceGuard } from '../common/guards/trusted-device.guard';
import type { AuthenticatedSession } from '../common/types/auth.types';
import { ChangeConfidentialityDto } from './dto/change-confidentiality.dto';
import { UpdateValidityDto } from './dto/update-validity.dto';
import { SourceItemsService } from './source-items.service';

@Controller('api/source-items')
@UseGuards(SessionGuard, TrustedDeviceGuard)
export class SourceItemsController {
  constructor(private readonly sourceItemsService: SourceItemsService) {}

  @Get(':sourceItemId')
  async getSourceItem(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Param('sourceItemId') sourceItemId: string,
  ) {
    return this.sourceItemsService.getSourceItemForOwner(sessionActor.userId, sourceItemId);
  }

  @Post(':sourceItemId/revoke')
  async revokeSourceItem(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Param('sourceItemId') sourceItemId: string,
  ) {
    return this.sourceItemsService.revokeSourceItemForOwner(sessionActor.userId, sourceItemId);
  }

  @Post(':sourceItemId/confidentiality')
  async changeConfidentiality(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Param('sourceItemId') sourceItemId: string,
    @Body() input: ChangeConfidentialityDto,
  ) {
    return this.sourceItemsService.changeConfidentialityForOwner(
      sessionActor.userId,
      sourceItemId,
      input.confidentialityLevel,
    );
  }

  @Post(':sourceItemId/validity')
  async updateValidity(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Param('sourceItemId') sourceItemId: string,
    @Body() input: UpdateValidityDto,
  ) {
    return this.sourceItemsService.updateValidityForOwner(
      sessionActor.userId,
      sourceItemId,
      input.requestedValidityMinutes ?? null,
    );
  }
}
