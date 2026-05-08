import { Injectable, PayloadTooLargeException } from '@nestjs/common';
import { createReadStream, createWriteStream } from 'fs';
import { mkdir, rm, stat } from 'fs/promises';
import { dirname, resolve } from 'path';
import { Transform, type Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { createHash, randomUUID } from 'crypto';

@Injectable()
export class LocalDiskStorageDriver {
  private readonly storageRoot = resolve(
    process.env.STORAGE_ROOT ?? resolve(process.cwd(), '.liminalis-storage'),
  );

  async writeUploadPart(input: {
    userId: string;
    uploadSessionId: string;
    partNumber: number;
    body: Readable;
    maxByteSize?: number;
  }) {
    const storageKey = [
      'uploads',
      input.userId,
      input.uploadSessionId,
      `${String(input.partNumber).padStart(6, '0')}-${randomUUID()}.bin`,
    ].join('/');
    const targetPath = this.pathForKey(storageKey);

    await mkdir(dirname(targetPath), { recursive: true });

    let byteSize = 0;
    const hash = createHash('sha256');

    try {
      await pipeline(
        input.body,
        this.countingTransform(hash, (count) => {
          byteSize = count;
          if (input.maxByteSize && count > input.maxByteSize) {
            throw new PayloadTooLargeException('Upload part is too large');
          }
        }),
        createWriteStream(targetPath),
      );
    } catch (error) {
      await rm(targetPath, { force: true });
      throw error;
    }

    return {
      storageKey,
      byteSize,
      checksum: `sha256:${hash.digest('hex')}`,
    };
  }

  async writeLiveTransferRelayChunk(input: {
    sessionId: string;
    senderDeviceId: string;
    sequence: number;
    body: Readable;
    maxByteSize?: number;
  }) {
    const storageKey = [
      'live-transfer-relay',
      input.sessionId,
      input.senderDeviceId,
      `${String(input.sequence).padStart(8, '0')}-${randomUUID()}.bin`,
    ].join('/');
    const targetPath = this.pathForKey(storageKey);

    await mkdir(dirname(targetPath), { recursive: true });

    let byteSize = 0;
    const hash = createHash('sha256');

    try {
      await pipeline(
        input.body,
        this.countingTransform(hash, (count) => {
          byteSize = count;
          if (input.maxByteSize && count > input.maxByteSize) {
            throw new PayloadTooLargeException('Relay chunk is too large');
          }
        }),
        createWriteStream(targetPath),
      );
    } catch (error) {
      await rm(targetPath, { force: true });
      throw error;
    }

    return {
      storageKey,
      byteSize,
      checksum: `sha256:${hash.digest('hex')}`,
    };
  }

  createReadStream(storageKey: string) {
    return createReadStream(this.pathForKey(storageKey));
  }

  async stat(storageKey: string) {
    return stat(this.pathForKey(storageKey));
  }

  async exists(storageKey: string) {
    try {
      await this.stat(storageKey);
      return true;
    } catch {
      return false;
    }
  }

  async remove(storageKey: string) {
    await rm(this.pathForKey(storageKey), { force: true });
  }

  private countingTransform(
    hash: ReturnType<typeof createHash>,
    onCount: (byteSize: number) => void,
  ) {
    let byteSize = 0;
    return new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        try {
          byteSize += chunk.length;
          hash.update(chunk);
          onCount(byteSize);
          callback(null, chunk);
        } catch (error) {
          callback(error instanceof Error ? error : new Error(String(error)));
        }
      },
    });
  }

  private pathForKey(storageKey: string) {
    if (storageKey.includes('\\')) {
      throw new Error('Invalid storage key');
    }

    const resolved = resolve(this.storageRoot, storageKey);
    if (
      !resolved.startsWith(`${this.storageRoot}/`) &&
      resolved !== this.storageRoot
    ) {
      throw new Error('Invalid storage key');
    }

    return resolved;
  }
}
