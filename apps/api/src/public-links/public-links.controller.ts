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
import { SessionActor } from '../common/decorators/session.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import { TrustedDeviceGuard } from '../common/guards/trusted-device.guard';
import { attachmentDisposition } from '../common/http/download-headers';
import type { AuthenticatedSession } from '../common/types/auth.types';
import { CreatePublicLinkDto } from './dto/create-public-link.dto';
import { PublicLinksService } from './public-links.service';

@Controller('api/public-links')
export class PublicLinksController {
  constructor(private readonly publicLinksService: PublicLinksService) {}

  @Post()
  @UseGuards(SessionGuard, TrustedDeviceGuard)
  async createPublicLink(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Body() input: CreatePublicLinkDto,
  ) {
    return this.publicLinksService.createPublicLink(sessionActor.userId, input);
  }

  @Get(':linkToken')
  async downloadPublicLink(
    @Param('linkToken') linkToken: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const download =
      await this.publicLinksService.createPublicDownload(linkToken);

    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader('Content-Length', String(download.contentLength));
    response.setHeader(
      'X-Liminalis-Package',
      Buffer.from(
        JSON.stringify(download.packageReference ?? null),
        'utf8',
      ).toString('base64url'),
    );
    response.setHeader(
      'X-Liminalis-Encrypted-Metadata',
      Buffer.from(
        JSON.stringify(download.encryptedMetadata ?? null),
        'utf8',
      ).toString('base64url'),
    );
    response.setHeader(
      'X-Liminalis-Content-Crypto',
      Buffer.from(
        JSON.stringify(download.contentCryptoMetadata ?? null),
        'utf8',
      ).toString('base64url'),
    );
    response.setHeader(
      'Content-Disposition',
      attachmentDisposition(download.fileName),
    );
    response.on('finish', () => {
      void this.publicLinksService.finishPublicDownload(
        download.reservationTicketToken,
      );
    });
    response.on('close', () => {
      if (!response.writableEnded) {
        void this.publicLinksService.releasePublicDownload(
          download.reservationTicketToken,
        );
      }
    });

    return new StreamableFile(download.stream);
  }

  @Post(':linkToken/tickets')
  async issueDeliveryTicket(@Param('linkToken') linkToken: string) {
    return this.publicLinksService.issueDeliveryTicket(linkToken);
  }

  @Post('tickets/:ticketToken/redeem')
  async redeemDeliveryTicket(@Param('ticketToken') ticketToken: string) {
    return this.publicLinksService.redeemDeliveryTicket(ticketToken);
  }
}
