import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { PolicyModule } from '../policy/policy.module';
import { StorageModule } from '../storage/storage.module';
import { PublicLinksController } from './public-links.controller';
import { PublicLinksService } from './public-links.service';

@Module({
  imports: [IdentityModule, PolicyModule, StorageModule],
  controllers: [PublicLinksController],
  providers: [PublicLinksService],
  exports: [PublicLinksService],
})
export class PublicLinksModule {}
