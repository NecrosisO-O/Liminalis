import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { PolicyModule } from '../policy/policy.module';
import { PrismaModule } from '../prisma/prisma.module';
import { LiveTransferController } from './live-transfer.controller';
import { LiveTransferService } from './live-transfer.service';

@Module({
  imports: [IdentityModule, PolicyModule, PrismaModule],
  controllers: [LiveTransferController],
  providers: [LiveTransferService],
  exports: [LiveTransferService],
})
export class LiveTransferModule {}
