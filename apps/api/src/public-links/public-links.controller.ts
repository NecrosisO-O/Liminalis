import { Body, Controller, Get, Param, Post, Res, StreamableFile, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { SessionActor } from '../common/decorators/session.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import { TrustedDeviceGuard } from '../common/guards/trusted-device.guard';
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
    const download = await this.publicLinksService.createPublicDownload(linkToken);

    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader('Content-Length', String(download.contentLength));
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${download.fileName.replace(/"/g, '')}"`,
    );
    response.on('finish', () => {
      void this.publicLinksService.completePublicDownload(download.publicLinkId);
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
