import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SessionActor } from '../common/decorators/session.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import type { AuthenticatedSession } from '../common/types/auth.types';
import { CreatePublicLinkDto } from './dto/create-public-link.dto';
import { PublicLinksService } from './public-links.service';

@Controller('api/public-links')
export class PublicLinksController {
  constructor(private readonly publicLinksService: PublicLinksService) {}

  @Post()
  @UseGuards(SessionGuard)
  async createPublicLink(
    @SessionActor() sessionActor: AuthenticatedSession,
    @Body() input: CreatePublicLinkDto,
  ) {
    return this.publicLinksService.createPublicLink(sessionActor.userId, input);
  }

  @Get(':linkToken')
  async getPublicLink(@Param('linkToken') linkToken: string) {
    return this.publicLinksService.getPublicLink(linkToken);
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
