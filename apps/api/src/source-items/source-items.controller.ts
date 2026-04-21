import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { SessionActor } from '../common/decorators/session.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import type { AuthenticatedSession } from '../common/types/auth.types';
import { SourceItemsService } from './source-items.service';

@Controller('api/source-items')
@UseGuards(SessionGuard)
export class SourceItemsController {
  constructor(private readonly sourceItemsService: SourceItemsService) {}

  @Get(':sourceItemId')
  async getSourceItem(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Param('sourceItemId') sourceItemId: string,
  ) {
    return this.sourceItemsService.getSourceItemForOwner(sessionActor.userId, sourceItemId);
  }
}
