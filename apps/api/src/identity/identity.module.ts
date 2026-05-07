import { Module } from '@nestjs/common';
import { BootstrapService } from './bootstrap.service';
import { AdminUsersController } from './admin.controller';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { SessionsService } from './sessions.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [IdentityController, AdminUsersController],
  providers: [IdentityService, SessionsService, BootstrapService],
  exports: [IdentityService, SessionsService, BootstrapService],
})
export class IdentityModule {}
