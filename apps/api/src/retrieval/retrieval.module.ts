import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { RetrievalController } from './retrieval.controller';
import { RetrievalService } from './retrieval.service';

@Module({
  imports: [IdentityModule],
  controllers: [RetrievalController],
  providers: [RetrievalService],
  exports: [RetrievalService],
})
export class RetrievalModule {}
