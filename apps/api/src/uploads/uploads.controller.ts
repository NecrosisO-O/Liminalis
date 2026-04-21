import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { SessionActor } from '../common/decorators/session.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import type { AuthenticatedSession } from '../common/types/auth.types';
import { FinalizeUploadDto } from './dto/finalize-upload.dto';
import { PrepareUploadDto } from './dto/prepare-upload.dto';
import { RegisterUploadPartDto } from './dto/register-upload-part.dto';
import { UploadsService } from './uploads.service';

@Controller('api/uploads')
@UseGuards(SessionGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('prepare')
  async prepareUpload(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Body() input: PrepareUploadDto,
  ) {
    return this.uploadsService.prepareUpload(sessionActor.userId, input);
  }

  @Post(':uploadSessionId/parts')
  async registerUploadPart(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Param('uploadSessionId') uploadSessionId: string,
    @Body() input: RegisterUploadPartDto,
  ) {
    return this.uploadsService.registerUploadPart(sessionActor.userId, uploadSessionId, input);
  }

  @Post(':uploadSessionId/finalize')
  async finalizeUpload(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Param('uploadSessionId') uploadSessionId: string,
    @Body() input: FinalizeUploadDto,
  ) {
    return this.uploadsService.finalizeUpload(sessionActor.userId, uploadSessionId, input);
  }
}
