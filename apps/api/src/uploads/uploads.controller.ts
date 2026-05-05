import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionActor } from '../common/decorators/session.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import { TrustedDeviceGuard } from '../common/guards/trusted-device.guard';
import type { AuthenticatedSession } from '../common/types/auth.types';
import { FinalizeUploadDto } from './dto/finalize-upload.dto';
import { PrepareUploadDto } from './dto/prepare-upload.dto';
import { RegisterUploadPartDto } from './dto/register-upload-part.dto';
import { UploadsService } from './uploads.service';

@Controller('api/uploads')
@UseGuards(SessionGuard, TrustedDeviceGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('prepare')
  async prepareUpload(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Body() input: PrepareUploadDto,
  ) {
    return this.uploadsService.prepareUpload(
      sessionActor.userId,
      sessionActor.trustedDeviceId,
      input,
    );
  }

  @Post(':uploadSessionId/parts')
  async registerUploadPart(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Param('uploadSessionId') uploadSessionId: string,
    @Body() input: RegisterUploadPartDto,
  ) {
    return this.uploadsService.registerUploadPart(
      sessionActor.userId,
      uploadSessionId,
      input,
    );
  }

  @Post(':uploadSessionId/parts/:partNumber/blob')
  async uploadPartBody(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Param('uploadSessionId') uploadSessionId: string,
    @Param('partNumber', ParseIntPipe) partNumber: number,
    @Req() request: Request,
  ) {
    return this.uploadsService.storeUploadPartBody(
      sessionActor.userId,
      uploadSessionId,
      partNumber,
      request,
    );
  }

  @Post(':uploadSessionId/finalize')
  async finalizeUpload(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Param('uploadSessionId') uploadSessionId: string,
    @Body() input: FinalizeUploadDto,
  ) {
    return this.uploadsService.finalizeUpload(
      sessionActor.userId,
      sessionActor.trustedDeviceId,
      uploadSessionId,
      input,
    );
  }
}
