import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { PolicyModule } from '../policy/policy.module';
import { PublicLinksController } from './public-links.controller';
import { PublicLinksService } from './public-links.service';

@Module({
  imports: [IdentityModule, PolicyModule],
  controllers: [PublicLinksController],
  providers: [PublicLinksService],
  exports: [PublicLinksService],
})
export class PublicLinksModule {}
