import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { SourceItemsController } from './source-items.controller';
import { SourceItemsService } from './source-items.service';

@Module({
  imports: [IdentityModule],
  controllers: [SourceItemsController],
  providers: [SourceItemsService],
  exports: [SourceItemsService],
})
export class SourceItemsModule {}
