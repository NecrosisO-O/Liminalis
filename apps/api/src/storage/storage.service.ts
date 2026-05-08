import { BadRequestException, Injectable } from '@nestjs/common';
import type { Stats } from 'fs';
import { Readable } from 'stream';
import { LocalDiskStorageDriver } from './local-disk-storage.driver';

@Injectable()
export class StorageService {
  private readonly uploadPartMaxBytes = this.envNumber(
    'UPLOAD_PART_MAX_BYTES',
    16 * 1024 * 1024,
  );

  private readonly liveRelayChunkMaxBytes = this.envNumber(
    'LIVE_RELAY_CHUNK_MAX_BYTES',
    2 * 1024 * 1024,
  );

  constructor(
    private readonly localDiskStorageDriver: LocalDiskStorageDriver,
  ) {}

  async writeUploadPart(input: {
    userId: string;
    uploadSessionId: string;
    partNumber: number;
    body: Readable;
  }) {
    const result = await this.localDiskStorageDriver.writeUploadPart({
      ...input,
      maxByteSize: this.uploadPartMaxBytes,
    });

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
      await this.localDiskStorageDriver.writeLiveTransferRelayChunk({
        ...input,
        maxByteSize: this.liveRelayChunkMaxBytes,
      });

    if (result.byteSize <= 0) {
      await this.localDiskStorageDriver.remove(result.storageKey);
      throw new BadRequestException('Relay chunk body is empty');
    }

    return result;
  }

  async requireExistingObject(storageKey: string, expectedByteSize?: number) {
    let stats: Stats;

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

  private envNumber(name: string, fallback: number) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
