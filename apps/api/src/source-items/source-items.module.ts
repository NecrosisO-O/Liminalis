import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { PolicyModule } from '../policy/policy.module';
import { ProjectionsModule } from '../projections/projections.module';
import { SourceItemsController } from './source-items.controller';
import { SourceItemsService } from './source-items.service';

@Module({
  imports: [IdentityModule, PolicyModule, ProjectionsModule],
  controllers: [SourceItemsController],
  providers: [SourceItemsService],
  exports: [SourceItemsService],
})
export class SourceItemsModule {}
