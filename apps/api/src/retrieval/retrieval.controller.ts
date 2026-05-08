import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { RetrievalFamily } from '../../generated/prisma/index.js';
import { SessionActor } from '../common/decorators/session.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import { TrustedDeviceGuard } from '../common/guards/trusted-device.guard';
import { attachmentDisposition } from '../common/http/download-headers';
import type { AuthenticatedSession } from '../common/types/auth.types';
import { SharesService } from '../shares/shares.service';
import { CompleteRetrievalDto } from './dto/complete-retrieval.dto';
import { RetrievalService } from './retrieval.service';

@Controller('api/retrieval')
@UseGuards(SessionGuard, TrustedDeviceGuard)
export class RetrievalController {
  constructor(
    private readonly retrievalService: RetrievalService,
    private readonly sharesService: SharesService,
  ) {}

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
    const retrievalAttempt =
      await this.retrievalService.getAttempt(retrievalAttemptId);

    if (
      retrievalAttempt.retrievalFamily ===
      RetrievalFamily.SHARE_OBJECT_RECIPIENT
    ) {
      return this.sharesService.completeRecipientRetrieval(
        sessionActor.userId,
        sessionActor.trustedDeviceId,
        retrievalAttemptId,
        input.success,
      );
    }

    return this.retrievalService.completeSourceItemRetrieval(
      sessionActor.userId,
      sessionActor.trustedDeviceId,
      retrievalAttemptId,
      input.success,
    );
  }

  @Get('attempts/:retrievalAttemptId/download')
  async downloadAttempt(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Param('retrievalAttemptId') retrievalAttemptId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const download = await this.retrievalService.createDownloadStreamForAttempt(
      sessionActor.userId,
      sessionActor.trustedDeviceId,
      retrievalAttemptId,
    );

    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader('Content-Length', String(download.contentLength));
    response.setHeader(
      'Content-Disposition',
      attachmentDisposition(download.fileName),
    );

    return new StreamableFile(download.stream);
  }
}
