import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import type { Request } from 'express';

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitInput = {
  scope: string;
  request?: Request;
  keyParts?: Array<string | number | null | undefined>;
  limit: number;
  windowMs: number;
  message?: string;
};

function envFlag(value: string | undefined) {
  if (!value) {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function firstHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function clientAddress(request: Request | undefined) {
  if (!request) {
    return 'unknown';
  }

  const forwardedFor = firstHeaderValue(request.headers['x-forwarded-for']);
  if (forwardedFor) {
    const addresses = forwardedFor
      .split(',')
      .map((address) => address.trim())
      .filter((address) => address.length > 0);

    return addresses.at(-1) ?? 'unknown';
  }

  return request.ip || request.socket.remoteAddress || 'unknown';
}

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, RateLimitBucket>();

  assertAllowed(input: RateLimitInput) {
    if (this.disabled()) {
      return;
    }

    const now = Date.now();
    const bucketKey = this.bucketKey(input, clientAddress(input.request));
    const existing = this.buckets.get(bucketKey);

    if (!existing || existing.resetAt <= now) {
      this.buckets.set(bucketKey, {
        count: 1,
        resetAt: now + input.windowMs,
      });
      this.prune(now);
      return;
    }

    existing.count += 1;
    if (existing.count > input.limit) {
      throw new HttpException(
        input.message ?? 'Too many attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private disabled() {
    return (
      process.env.NODE_ENV === 'test' || envFlag(process.env.RATE_LIMIT_DISABLED)
    );
  }

  private bucketKey(input: RateLimitInput, address: string) {
    const hash = createHash('sha256')
      .update(
        [address, ...(input.keyParts ?? [])]
          .map((part) => String(part ?? ''))
          .join('|'),
      )
      .digest('base64url');

    return `${input.scope}:${hash}`;
  }

  private prune(now: number) {
    if (this.buckets.size < 10_000) {
      return;
    }

    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
