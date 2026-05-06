import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/instance')
export class InstanceController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('public-settings')
  async getPublicSettings() {
    const settings = await this.prisma.instanceSetting.findUnique({
      where: { singletonKey: 'default' },
      select: { publicOrigin: true },
    });

    return {
      publicOrigin: settings?.publicOrigin ?? null,
    };
  }
}
