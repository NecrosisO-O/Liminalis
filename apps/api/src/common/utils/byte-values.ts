import { BadRequestException } from '@nestjs/common';

export const DEFAULT_STORAGE_QUOTA_BYTES = 1_073_741_824n;
export const MAX_SAFE_JSON_BYTES = BigInt(Number.MAX_SAFE_INTEGER);

export function bytesToBigInt(value: number | bigint | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === 'bigint' ? value : BigInt(value);
}

export function inputBytesToBigInt(value: number): bigint;
export function inputBytesToBigInt(
  value: number | null | undefined,
): bigint | null;
export function inputBytesToBigInt(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isSafeInteger(value) || value < 0) {
    throw new BadRequestException(
      'Byte value must be a safe non-negative integer',
    );
  }

  return BigInt(value);
}

export function bytesToJsonNumber(value: number | bigint | null | undefined) {
  if (value === null || value === undefined) {
    return value;
  }

  const bigintValue = bytesToBigInt(value);
  if (bigintValue !== null && bigintValue > MAX_SAFE_JSON_BYTES) {
    throw new BadRequestException('Byte value exceeds JSON safe integer range');
  }

  return Number(bigintValue);
}

export function sumBytes(values: Array<number | bigint>) {
  let sum = 0n;
  for (const value of values) {
    sum += bytesToBigInt(value)!;
  }
  return sum;
}

export function partsForJson<T extends { byteSize: number | bigint }>(
  parts: T[],
) {
  return parts.map((part) => ({
    ...part,
    byteSize: bytesToJsonNumber(part.byteSize),
  }));
}

export function projectionBytesForJson<
  T extends { visibleSizeBytes?: number | bigint | null },
>(item: T) {
  return {
    ...item,
    visibleSizeBytes: bytesToJsonNumber(item.visibleSizeBytes),
  };
}
