import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { ProjectionsModule } from '../projections/projections.module';
import { SharesModule } from '../shares/shares.module';
import { RetrievalController } from './retrieval.controller';
import { RetrievalService } from './retrieval.service';

@Module({
  imports: [IdentityModule, ProjectionsModule, SharesModule],
  controllers: [RetrievalController],
  providers: [RetrievalService],
  exports: [RetrievalService],
})
export class RetrievalModule {}
