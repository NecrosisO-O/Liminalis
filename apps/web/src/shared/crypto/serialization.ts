export function utf8ToBytes(value: string) {
  return new TextEncoder().encode(value)
}

export function bytesToUtf8(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes)
}

export function randomBytes(length: number) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

export function browserBytes(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy
}

export function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

export function base64UrlToBytes(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

export function jsonToBytes(value: unknown) {
  return utf8ToBytes(JSON.stringify(value))
}

export function bytesToJson<T>(bytes: Uint8Array) {
  return JSON.parse(bytesToUtf8(bytes)) as T
}

export async function blobToBytes(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer())
}
