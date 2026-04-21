import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SessionActor } from '../common/decorators/session.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import type { AuthenticatedSession } from '../common/types/auth.types';
import { CompleteRetrievalDto } from '../retrieval/dto/complete-retrieval.dto';
import { CreateExtractionDto } from './dto/create-extraction.dto';
import { SubmitExtractionPasswordDto } from './dto/submit-extraction-password.dto';
import { ExtractionService } from './extraction.service';

@Controller('api/extraction')
export class ExtractionController {
  constructor(private readonly extractionService: ExtractionService) {}

  @Post()
  @UseGuards(SessionGuard)
  async createExtraction(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Body() input: CreateExtractionDto,
  ) {
    return this.extractionService.createExtraction(sessionActor.userId, input);
  }

  @Get(':entryToken')
  async getExtractionEntry(@Param('entryToken') entryToken: string) {
    return this.extractionService.getExtractionEntry(entryToken);
  }

  @Post(':entryToken/attempts/:attemptScopeKey')
  async submitExtractionPassword(
    @Param('entryToken') entryToken: string,
    @Param('attemptScopeKey') attemptScopeKey: string,
    @Body() input: SubmitExtractionPasswordDto,
  ) {
    return this.extractionService.submitPassword(entryToken, attemptScopeKey, input);
  }

  @Post('attempts/:retrievalAttemptId/complete')
  async completeExtractionRetrieval(
    @Param('retrievalAttemptId') retrievalAttemptId: string,
    @Body() input: CompleteRetrievalDto,
  ) {
    return this.extractionService.completeExtractionRetrieval(retrievalAttemptId, input.success);
  }
}
