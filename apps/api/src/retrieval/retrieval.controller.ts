import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { SessionActor } from '../common/decorators/session.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import type { AuthenticatedSession } from '../common/types/auth.types';
import { CompleteRetrievalDto } from './dto/complete-retrieval.dto';
import { RetrievalService } from './retrieval.service';

@Controller('api/retrieval')
@UseGuards(SessionGuard)
export class RetrievalController {
  constructor(private readonly retrievalService: RetrievalService) {}

  @Post('source-items/:sourceItemId/attempts/:attemptScopeKey')
  async issueSourceItemRetrieval(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Param('sourceItemId') sourceItemId: string,
    @Param('attemptScopeKey') attemptScopeKey: string,
  ) {
    return this.retrievalService.issueSourceItemRetrieval(
      sessionActor.userId,
      sessionActor.trustedDeviceId,
      sourceItemId,
      attemptScopeKey,
    );
  }

  @Post('attempts/:retrievalAttemptId/complete')
  async completeRetrieval(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Param('retrievalAttemptId') retrievalAttemptId: string,
    @Body() input: CompleteRetrievalDto,
  ) {
    return this.retrievalService.completeSourceItemRetrieval(
      sessionActor.userId,
      sessionActor.trustedDeviceId,
      retrievalAttemptId,
      input.success,
    );
  }
}
