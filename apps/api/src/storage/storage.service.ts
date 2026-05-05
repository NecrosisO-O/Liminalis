import { BadRequestException, Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import { LocalDiskStorageDriver } from './local-disk-storage.driver';

@Injectable()
export class StorageService {
  constructor(
    private readonly localDiskStorageDriver: LocalDiskStorageDriver,
  ) {}

  async writeUploadPart(input: {
    userId: string;
    uploadSessionId: string;
    partNumber: number;
    body: Readable;
  }) {
    const result = await this.localDiskStorageDriver.writeUploadPart(input);

    if (result.byteSize <= 0) {
      await this.localDiskStorageDriver.remove(result.storageKey);
      throw new BadRequestException('Upload part body is empty');
    }

    return result;
  }

  async writeLiveTransferRelayChunk(input: {
    sessionId: string;
    senderDeviceId: string;
    sequence: number;
    body: Readable;
  }) {
    const result =
      await this.localDiskStorageDriver.writeLiveTransferRelayChunk(input);

    if (result.byteSize <= 0) {
      await this.localDiskStorageDriver.remove(result.storageKey);
      throw new BadRequestException('Relay chunk body is empty');
    }

    return result;
  }

  async requireExistingObject(storageKey: string, expectedByteSize?: number) {
    let stats;

    try {
      stats = await this.localDiskStorageDriver.stat(storageKey);
    } catch {
      throw new BadRequestException('Stored upload object not found');
    }

    if (expectedByteSize !== undefined && stats.size !== expectedByteSize) {
      throw new BadRequestException(
        'Stored upload object size does not match metadata',
      );
    }

    return {
      storageKey,
      byteSize: stats.size,
    };
  }

  createReadStream(storageKey: string) {
    return this.localDiskStorageDriver.createReadStream(storageKey);
  }

  async remove(storageKey: string) {
    await this.localDiskStorageDriver.remove(storageKey);
  }
}
