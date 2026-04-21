import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SessionActor } from '../common/decorators/session.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import type { AuthenticatedSession } from '../common/types/auth.types';
import { ProjectionsService } from './projections.service';

@Controller('api')
@UseGuards(SessionGuard)
export class ProjectionsController {
  constructor(private readonly projectionsService: ProjectionsService) {}

  @Get('timeline')
  async getTimeline(@SessionActor() sessionActor: AuthenticatedSession) {
    return this.projectionsService.getActiveTimeline(sessionActor.userId);
  }

  @Get('history')
  async getHistory(@SessionActor() sessionActor: AuthenticatedSession) {
    return this.projectionsService.getHistory(sessionActor.userId);
  }

  @Get('search')
  async search(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Query('q') query: string,
  ) {
    return this.projectionsService.search(sessionActor.userId, query ?? '');
  }
}
