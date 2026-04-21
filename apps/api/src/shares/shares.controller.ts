import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SessionActor } from '../common/decorators/session.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import type { AuthenticatedSession } from '../common/types/auth.types';
import { CompleteRetrievalDto } from '../retrieval/dto/complete-retrieval.dto';
import { CreateShareDto } from './dto/create-share.dto';
import { SharesService } from './shares.service';

@Controller('api/shares')
@UseGuards(SessionGuard)
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Post()
  async createShare(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Body() input: CreateShareDto,
  ) {
    return this.sharesService.createUserTargetedShare(sessionActor.userId, input);
  }

  @Get('incoming')
  async getIncomingShares(@SessionActor() sessionActor: AuthenticatedSession) {
    return this.sharesService.getIncomingShares(sessionActor.userId);
  }

  @Post(':shareObjectId/attempts/:attemptScopeKey')
  async issueRecipientRetrieval(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Param('shareObjectId') shareObjectId: string,
    @Param('attemptScopeKey') attemptScopeKey: string,
  ) {
    return this.sharesService.issueRecipientRetrieval(
      sessionActor.userId,
      sessionActor.trustedDeviceId,
      shareObjectId,
      attemptScopeKey,
    );
  }

  @Post('attempts/:retrievalAttemptId/complete')
  async completeRecipientRetrieval(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Param('retrievalAttemptId') retrievalAttemptId: string,
    @Body() input: CompleteRetrievalDto,
  ) {
    return this.sharesService.completeRecipientRetrieval(
      sessionActor.userId,
      sessionActor.trustedDeviceId,
      retrievalAttemptId,
      input.success,
    );
  }
}
