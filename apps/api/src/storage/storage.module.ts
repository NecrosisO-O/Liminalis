import { Module } from '@nestjs/common';
import { LocalDiskStorageDriver } from './local-disk-storage.driver';
import { StorageService } from './storage.service';

@Module({
  providers: [LocalDiskStorageDriver, StorageService],
  exports: [StorageService],
})
export class StorageModule {}
