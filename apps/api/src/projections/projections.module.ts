import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { ProjectionService } from './projection.service';
import { ProjectionsController } from './projections.controller';
import { ProjectionsService } from './projections.service';

@Module({
  imports: [IdentityModule],
  controllers: [ProjectionsController],
  providers: [ProjectionService, ProjectionsService],
  exports: [ProjectionService, ProjectionsService],
})
export class ProjectionsModule {}
