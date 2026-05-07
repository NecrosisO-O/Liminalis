import {
  base64UrlToBytes,
  blobToBytes,
  browserBytes,
  bytesToBase64Url,
  bytesToJson,
  bytesToUtf8,
  jsonToBytes,
  randomBytes,
  utf8ToBytes,
} from './serialization.ts'
import {
  decryptWithAesKey,
  deriveWrappingKey,
  encryptWithAesKey,
  exportUserDomainPrivateJwk,
  importWrappingPublicKey,
  parsePublicKeyPayload,
  requireUserDomainVault,
  requireVault,
} from './vault.ts'

export const e2eeVersion = 'e2ee-v1'

export type EncryptedBlobEnvelope = {
  version: typeof e2eeVersion
  algorithm: 'AES-GCM-256'
  nonce: string
  ciphertext: string
  aad: string
  plaintextBytes: number
}

export type SourceMetadata = {
  displayName: string
  visibleSummary?: string | null
  manifest?: Record<string, unknown>
  originalFileCount?: number
  originalBytes?: number
  contentType?: string
}

export type SourceKeyEnvelope = {
  version: typeof e2eeVersion
  envelopeKind: 'owner-domain' | 'pairing-device' | 'password' | 'public-link'
  wrapping: {
    algorithm: 'ECDH-P256-HKDF-SHA256-AES-GCM' | 'PBKDF2-SHA256-AES-GCM' | 'AES-GCM-256'
    nonce: string
    ciphertext: string
    aad: string
    ephemeralPublicKey?: JsonWebKey
    salt?: string
    iterations?: number
  }
}

export type SourceCryptoPackage = {
  version: typeof e2eeVersion
  ownerKeyEnvelope: SourceKeyEnvelope
  encryptedMetadata: EncryptedBlobEnvelope
  contentCryptoMetadata: {
    version: typeof e2eeVersion
    contentAlgorithm: 'AES-GCM-256'
    fileMode?: 'single-blob-v1' | 'chunked-v1'
    chunkPlaintextSize?: number
    chunks?: Array<{ partNumber: number; nonce: string; aad: string; plaintextBytes: number; ciphertextBytes: number }>
    text?: { nonce: string; aad: string; plaintextBytes: number; ciphertextBytes: number }
  }
}

export type EncryptedUploadPackage = SourceCryptoPackage & {
  textCiphertextBody?: string
  encryptedBlob?: Blob
}

export type PairingApprovalPackage = {
  version: typeof e2eeVersion
  userDomainPrivateKeyEnvelope: SourceKeyEnvelope
}

async function generateAesKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

async function importAesKey(rawKey: Uint8Array, usages: KeyUsage[] = ['encrypt', 'decrypt']) {
  return crypto.subtle.importKey('raw', browserBytes(rawKey), { name: 'AES-GCM' }, false, usages)
}

async function exportRawAesKey(key: CryptoKey) {
  return new Uint8Array(await crypto.subtle.exportKey('raw', key))
}

async function encryptAesEnvelope(plaintext: Uint8Array, aad: string, key?: CryptoKey) {
  const contentKey = key ?? await generateAesKey()
  const encrypted = await encryptWithAesKey(contentKey, plaintext, aad)
  return {
    contentKey,
    envelope: {
      version: e2eeVersion,
      algorithm: 'AES-GCM-256',
      nonce: encrypted.nonce,
      ciphertext: encrypted.ciphertext,
      aad,
      plaintextBytes: plaintext.byteLength,
    } satisfies EncryptedBlobEnvelope,
  }
}

async function decryptAesEnvelope(envelope: EncryptedBlobEnvelope, key: CryptoKey) {
  return decryptWithAesKey(key, envelope, envelope.aad)
}

async function encryptBytesWithAesKey(key: CryptoKey, plaintext: Uint8Array, aad: string) {
  const nonce = randomBytes(12)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: browserBytes(nonce), additionalData: new TextEncoder().encode(aad) },
    key,
    browserBytes(plaintext),
  )

  return {
    nonce: bytesToBase64Url(nonce),
    ciphertextBytes: new Uint8Array(ciphertext),
  }
}

async function decryptBytesWithAesKey(key: CryptoKey, nonce: string, ciphertext: Uint8Array, aad: string) {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: browserBytes(base64UrlToBytes(nonce)),
      additionalData: new TextEncoder().encode(aad),
    },
    key,
    browserBytes(ciphertext),
  )

  return new Uint8Array(plaintext)
}

async function createEphemeralWrappingKeyPair() {
  return crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as Promise<CryptoKeyPair>
}

export async function wrapRawKeyForPublicKey(
  rawKey: Uint8Array,
  recipientPublicKeyPayload: string,
  aad: string,
  envelopeKind: SourceKeyEnvelope['envelopeKind'] = 'owner-domain',
): Promise<SourceKeyEnvelope> {
  const recipientPublicKey = await importWrappingPublicKey(parsePublicKeyPayload(recipientPublicKeyPayload))
  const ephemeral = await createEphemeralWrappingKeyPair()
  const wrappingKey = await deriveWrappingKey(ephemeral.privateKey, recipientPublicKey, aad)
  const wrapped = await encryptWithAesKey(wrappingKey, rawKey, aad)

  return {
    version: e2eeVersion,
    envelopeKind,
    wrapping: {
      algorithm: 'ECDH-P256-HKDF-SHA256-AES-GCM',
      nonce: wrapped.nonce,
      ciphertext: wrapped.ciphertext,
      aad,
      ephemeralPublicKey: await crypto.subtle.exportKey('jwk', ephemeral.publicKey),
    },
  }
}

export async function unwrapRawKeyFromEnvelope(envelope: SourceKeyEnvelope) {
  if (envelope.wrapping.algorithm !== 'ECDH-P256-HKDF-SHA256-AES-GCM' || !envelope.wrapping.ephemeralPublicKey) {
    throw new Error('Unsupported key envelope.')
  }

  const vault = await requireUserDomainVault()
  const ephemeralPublicKey = await importWrappingPublicKey(envelope.wrapping.ephemeralPublicKey)
  const wrappingKey = await deriveWrappingKey(vault.userDomainPrivateKey, ephemeralPublicKey, envelope.wrapping.aad)
  return decryptWithAesKey(wrappingKey, envelope.wrapping, envelope.wrapping.aad)
}

export async function createOwnerKeyEnvelope(rawKey: Uint8Array, sourceSubject: string) {
  const vault = await requireUserDomainVault()
  return wrapRawKeyForPublicKey(rawKey, vault.userDomainPublicKeyPayload, `liminalis:${e2eeVersion}:source:${sourceSubject}:owner-key`)
}

export async function createEncryptedSourceContext(input: {
  sourceSubject: string
  metadata: SourceMetadata
}) {
  const sourceKey = await generateAesKey()
  const rawSourceKey = await exportRawAesKey(sourceKey)
  const metadataEncrypted = await encryptAesEnvelope(
    jsonToBytes(input.metadata),
    `liminalis:${e2eeVersion}:source:${input.sourceSubject}:metadata`,
    sourceKey,
  )
  const ownerKeyEnvelope = await createOwnerKeyEnvelope(rawSourceKey, input.sourceSubject)

  return {
    sourceKey,
    ownerKeyEnvelope,
    encryptedMetadata: metadataEncrypted.envelope,
  }
}

export async function encryptFilePayloadChunk(input: {
  sourceKey: CryptoKey
  sourceSubject: string
  partNumber: number
  plaintext: Uint8Array
}) {
  const aad = `liminalis:${e2eeVersion}:source:${input.sourceSubject}:file:${input.partNumber}`
  const encrypted = await encryptBytesWithAesKey(input.sourceKey, input.plaintext, aad)

  return {
    encryptedBytes: encrypted.ciphertextBytes,
    chunk: {
      partNumber: input.partNumber,
      nonce: encrypted.nonce,
      aad,
      plaintextBytes: input.plaintext.byteLength,
      ciphertextBytes: encrypted.ciphertextBytes.byteLength,
    },
  }
}

export async function createEncryptedSourcePackage(input: {
  sourceSubject: string
  text?: string
  blob?: Blob
  metadata: SourceMetadata
}): Promise<EncryptedUploadPackage> {
  const { sourceKey, ownerKeyEnvelope, encryptedMetadata } = await createEncryptedSourceContext({
    sourceSubject: input.sourceSubject,
    metadata: input.metadata,
  })

  if (typeof input.text === 'string') {
    const aad = `liminalis:${e2eeVersion}:source:${input.sourceSubject}:text`
    const encryptedText = await encryptWithAesKey(sourceKey, utf8ToBytes(input.text), aad)
    return {
      version: e2eeVersion,
      ownerKeyEnvelope,
      encryptedMetadata,
      textCiphertextBody: JSON.stringify({
        version: e2eeVersion,
        algorithm: 'AES-GCM-256',
        nonce: encryptedText.nonce,
        ciphertext: encryptedText.ciphertext,
        aad,
      }),
      contentCryptoMetadata: {
        version: e2eeVersion,
        contentAlgorithm: 'AES-GCM-256',
        text: {
          nonce: encryptedText.nonce,
          aad,
          plaintextBytes: utf8ToBytes(input.text).byteLength,
          ciphertextBytes: base64UrlToBytes(encryptedText.ciphertext).byteLength,
        },
      },
    }
  }

  if (!input.blob) {
    throw new Error('A text body or file blob is required for encryption.')
  }

  const plaintext = await blobToBytes(input.blob)
  const aad = `liminalis:${e2eeVersion}:source:${input.sourceSubject}:file:1`
  const encryptedFile = await encryptWithAesKey(sourceKey, plaintext, aad)
  const encryptedBytes = base64UrlToBytes(encryptedFile.ciphertext)

  return {
    version: e2eeVersion,
    ownerKeyEnvelope,
    encryptedMetadata,
    encryptedBlob: new Blob([encryptedBytes], { type: 'application/octet-stream' }),
    contentCryptoMetadata: {
      version: e2eeVersion,
      contentAlgorithm: 'AES-GCM-256',
      fileMode: 'single-blob-v1',
      chunks: [{
        partNumber: 1,
        nonce: encryptedFile.nonce,
        aad,
        plaintextBytes: plaintext.byteLength,
        ciphertextBytes: encryptedBytes.byteLength,
      }],
    },
  }
}

export async function sourceKeyFromWrappedReference(wrappedPayloadReference: unknown) {
  const envelope = wrappedPayloadReference as SourceKeyEnvelope
  const rawKey = await unwrapRawKeyFromEnvelope(envelope)
  return importAesKey(rawKey)
}

export async function rawSourceKeyFromWrappedReference(wrappedPayloadReference: unknown) {
  return unwrapRawKeyFromEnvelope(wrappedPayloadReference as SourceKeyEnvelope)
}

export async function decryptSourceMetadata(input: { encryptedMetadata: unknown; wrappedPayloadReference: unknown }) {
  const key = await sourceKeyFromWrappedReference(input.wrappedPayloadReference)
  return decryptSourceMetadataWithKey(input.encryptedMetadata, key)
}

export async function decryptSourceMetadataWithKey(encryptedMetadata: unknown, key: CryptoKey) {
  const metadata = await decryptAesEnvelope(encryptedMetadata as EncryptedBlobEnvelope, key)
  return bytesToJson<SourceMetadata>(metadata)
}

export async function decryptTextPayload(textCiphertextBody: string, wrappedPayloadReference: unknown) {
  const key = await sourceKeyFromWrappedReference(wrappedPayloadReference)
  return decryptTextPayloadWithKey(textCiphertextBody, key)
}

export async function decryptTextPayloadWithKey(textCiphertextBody: string, key: CryptoKey) {
  const parsed = JSON.parse(textCiphertextBody) as { nonce: string; ciphertext: string; aad: string }
  const plaintext = await decryptWithAesKey(key, parsed, parsed.aad)
  return bytesToUtf8(plaintext)
}

export async function decryptFilePayload(blob: Blob, input: { wrappedPayloadReference: unknown; contentCryptoMetadata: unknown; encryptedMetadata?: unknown }) {
  const key = await sourceKeyFromWrappedReference(input.wrappedPayloadReference)
  return decryptFilePayloadWithKey(blob, input.contentCryptoMetadata, key)
}

export async function decryptFilePayloadWithKey(blob: Blob, contentCryptoMetadata: unknown, key: CryptoKey) {
  const metadata = contentCryptoMetadata as SourceCryptoPackage['contentCryptoMetadata'] | null
  const chunks = metadata?.chunks
  if (!chunks || chunks.length === 0) {
    return blob
  }

  const sortedChunks = [...chunks].sort((left, right) => left.partNumber - right.partNumber)
  const plaintextParts: BlobPart[] = []
  let offset = 0

  for (const chunk of sortedChunks) {
    const encryptedChunk = await blobToBytes(blob.slice(offset, offset + chunk.ciphertextBytes))
    const plaintext = await decryptBytesWithAesKey(key, chunk.nonce, encryptedChunk, chunk.aad)
    if (plaintext.byteLength !== chunk.plaintextBytes) {
      throw new Error('Encrypted file chunk metadata does not match decrypted bytes.')
    }
    plaintextParts.push(plaintext)
    offset += chunk.ciphertextBytes
  }

  if (offset !== blob.size) {
    throw new Error('Encrypted file payload does not match chunk metadata.')
  }

  return new Blob(plaintextParts, { type: 'application/octet-stream' })
}

export function encryptedFileCiphertextBytes(contentCryptoMetadata: unknown) {
  const metadata = contentCryptoMetadata as SourceCryptoPackage['contentCryptoMetadata'] | null
  const chunks = metadata?.chunks
  if (!chunks || chunks.length === 0) {
    return null
  }

  return chunks.reduce((sum, chunk) => sum + chunk.ciphertextBytes, 0)
}

export function canStreamDecryptFilePayload(contentCryptoMetadata: unknown) {
  const metadata = contentCryptoMetadata as SourceCryptoPackage['contentCryptoMetadata'] | null
  return Boolean(metadata?.chunks?.length)
}

function concatBytes(parts: Array<Uint8Array<ArrayBufferLike>>, byteLength: number) {
  const output = new Uint8Array(byteLength)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.byteLength
  }

  return output
}

export async function streamDecryptFilePayloadWithKey(input: {
  readable: ReadableStream<Uint8Array>
  contentCryptoMetadata: unknown
  key: CryptoKey
  write: (chunk: Uint8Array) => Promise<void>
}) {
  const metadata = input.contentCryptoMetadata as SourceCryptoPackage['contentCryptoMetadata'] | null
  const chunks = metadata?.chunks
  if (!chunks || chunks.length === 0) {
    throw new Error('Encrypted file metadata does not support stream decryption.')
  }

  const sortedChunks = [...chunks].sort((left, right) => left.partNumber - right.partNumber)
  const reader = input.readable.getReader()
  let carry: Uint8Array<ArrayBufferLike> = new Uint8Array()

  async function readExact(byteLength: number) {
    const parts: Array<Uint8Array<ArrayBufferLike>> = []
    let collected = 0

    if (carry.byteLength > 0) {
      const used = carry.subarray(0, byteLength)
      parts.push(used)
      collected += used.byteLength
      carry = carry.subarray(used.byteLength)
    }

    while (collected < byteLength) {
      const read = await reader.read()
      if (read.done) {
        throw new Error('Encrypted file stream ended before all chunks were read.')
      }

      const needed = byteLength - collected
      if (read.value.byteLength > needed) {
        parts.push(read.value.subarray(0, needed))
        carry = read.value.subarray(needed)
        collected += needed
      } else {
        parts.push(read.value)
        collected += read.value.byteLength
      }
    }

    return concatBytes(parts, byteLength)
  }

  try {
    for (const chunk of sortedChunks) {
      const encryptedChunk = await readExact(chunk.ciphertextBytes)
      const plaintext = await decryptBytesWithAesKey(input.key, chunk.nonce, encryptedChunk, chunk.aad)
      if (plaintext.byteLength !== chunk.plaintextBytes) {
        throw new Error('Encrypted file chunk metadata does not match decrypted bytes.')
      }
      await input.write(plaintext)
    }

    const finalRead = carry.byteLength > 0 ? { done: false } : await reader.read()
    if (!finalRead.done) {
      throw new Error('Encrypted file stream contains bytes beyond chunk metadata.')
    }
  } finally {
    reader.releaseLock()
  }
}

export async function createPairingApprovalPackage(requesterDeviceWrappingPublicKey: string): Promise<PairingApprovalPackage> {
  const privateJwk = await exportUserDomainPrivateJwk()
  const rawPrivateJwk = jsonToBytes(privateJwk)
  const envelope = await wrapRawKeyForPublicKey(
    rawPrivateJwk,
    requesterDeviceWrappingPublicKey,
    `liminalis:${e2eeVersion}:pairing:user-domain-private-key`,
  )
  return {
    version: e2eeVersion,
    userDomainPrivateKeyEnvelope: {
      ...envelope,
      envelopeKind: 'pairing-device',
    },
  }
}

export async function installPairingApprovalPackage(packagePayload: unknown) {
  const parsed = packagePayload as PairingApprovalPackage
  const envelope = parsed.userDomainPrivateKeyEnvelope
  if (!envelope?.wrapping?.ephemeralPublicKey) {
    throw new Error('Pairing approval package is missing encrypted key material.')
  }

  const vault = await requireVault()
  const ephemeralPublicKey = await importWrappingPublicKey(envelope.wrapping.ephemeralPublicKey)
  const wrappingKey = await deriveWrappingKey(vault.deviceWrappingPrivateKey, ephemeralPublicKey, envelope.wrapping.aad)
  const privateJwkBytes = await decryptWithAesKey(wrappingKey, envelope.wrapping, envelope.wrapping.aad)
  const privateJwk = bytesToJson<JsonWebKey>(privateJwkBytes)
  const { installUserDomainPrivateJwk } = await import('./vault.ts')
  await installUserDomainPrivateJwk(privateJwk)
}

export async function createPasswordWrappedSourceEnvelope(sourceEnvelope: SourceKeyEnvelope, password: string, aad: string) {
  const rawSourceKey = sourceEnvelope.envelopeKind === 'owner-domain'
    ? await unwrapRawKeyFromEnvelope(sourceEnvelope)
    : await rawSourceKeyFromWrappedReference(sourceEnvelope)
  const salt = randomBytes(16)
  const keyMaterial = await crypto.subtle.importKey('raw', browserBytes(utf8ToBytes(password)), 'PBKDF2', false, ['deriveKey'])
  const wrappingKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: browserBytes(salt),
      iterations: 210_000,
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
  const wrapped = await encryptWithAesKey(wrappingKey, rawSourceKey, aad)
  return {
    version: e2eeVersion,
    envelopeKind: 'password',
    wrapping: {
      algorithm: 'PBKDF2-SHA256-AES-GCM',
      salt: bytesToBase64Url(salt),
      iterations: 210_000,
      nonce: wrapped.nonce,
      ciphertext: wrapped.ciphertext,
      aad,
    },
  } satisfies SourceKeyEnvelope
}

export function generatePublicLinkSecret() {
  return bytesToBase64Url(randomBytes(32))
}

export async function createPublicLinkWrappedSourceEnvelope(sourceEnvelope: SourceKeyEnvelope, secret: string, aad: string) {
  const rawSourceKey = await rawSourceKeyFromWrappedReference(sourceEnvelope)
  const wrappingKey = await importAesKey(base64UrlToBytes(secret))
  const wrapped = await encryptWithAesKey(wrappingKey, rawSourceKey, aad)
  return {
    version: e2eeVersion,
    envelopeKind: 'public-link',
    wrapping: {
      algorithm: 'AES-GCM-256',
      nonce: wrapped.nonce,
      ciphertext: wrapped.ciphertext,
      aad,
    },
  } satisfies SourceKeyEnvelope
}

export async function createRecipientWrappedSourceEnvelope(sourceEnvelope: SourceKeyEnvelope, recipientPublicKey: string, aad: string) {
  const rawSourceKey = await rawSourceKeyFromWrappedReference(sourceEnvelope)
  return wrapRawKeyForPublicKey(rawSourceKey, recipientPublicKey, aad, 'owner-domain')
}

export async function sourceKeyFromPasswordEnvelope(envelope: SourceKeyEnvelope, password: string) {
  if (envelope.wrapping.algorithm !== 'PBKDF2-SHA256-AES-GCM' || !envelope.wrapping.salt || !envelope.wrapping.iterations) {
    throw new Error('Unsupported password envelope.')
  }

  const keyMaterial = await crypto.subtle.importKey('raw', browserBytes(utf8ToBytes(password)), 'PBKDF2', false, ['deriveKey'])
  const wrappingKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: browserBytes(base64UrlToBytes(envelope.wrapping.salt)),
      iterations: envelope.wrapping.iterations,
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )
  const rawSourceKey = await decryptWithAesKey(wrappingKey, envelope.wrapping, envelope.wrapping.aad)
  return importAesKey(rawSourceKey)
}

export async function sourceKeyFromPublicLinkEnvelope(envelope: SourceKeyEnvelope, secret: string) {
  if (envelope.wrapping.algorithm !== 'AES-GCM-256') {
    throw new Error('Unsupported public link envelope.')
  }

  const wrappingKey = await importAesKey(base64UrlToBytes(secret), ['decrypt'])
  const rawSourceKey = await decryptWithAesKey(wrappingKey, envelope.wrapping, envelope.wrapping.aad)
  return importAesKey(rawSourceKey)
}
