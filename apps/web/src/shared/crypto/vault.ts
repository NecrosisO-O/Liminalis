import { base64UrlToBytes, browserBytes, bytesToBase64Url, randomBytes } from './serialization.ts'

const databaseName = 'liminalis-e2ee-v1'
const storeName = 'vault'
const currentRecordKey = 'current'

export type DeviceMaterial = {
  devicePublicIdentity: string
  deviceWrappingPublicKey: string
  userDomainPublicKey: string
  createdAt: string
}

type PersistedVault = {
  id: string
  createdAt: string
  deviceIdentityPrivateJwk: JsonWebKey
  deviceIdentityPublicJwk: JsonWebKey
  deviceWrappingPrivateJwk: JsonWebKey
  deviceWrappingPublicJwk: JsonWebKey
  userDomainPrivateJwk: JsonWebKey | null
  userDomainPublicJwk: JsonWebKey | null
}

export type LocalVault = {
  createdAt: string
  deviceIdentityPrivateKey: CryptoKey
  deviceIdentityPublicKey: CryptoKey
  deviceWrappingPrivateKey: CryptoKey
  deviceWrappingPublicKey: CryptoKey
  userDomainPrivateKey: CryptoKey | null
  userDomainPublicKey: CryptoKey | null
  devicePublicIdentity: string
  deviceWrappingPublicKeyPayload: string
  userDomainPublicKeyPayload: string | null
}

export type UserDomainVault = LocalVault & {
  userDomainPrivateKey: CryptoKey
  userDomainPublicKey: CryptoKey
  userDomainPublicKeyPayload: string
}

function openVaultDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open browser key vault.'))
  })
}

async function readPersistedVault() {
  const database = await openVaultDatabase()
  return new Promise<PersistedVault | null>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly')
    const request = transaction.objectStore(storeName).get(currentRecordKey)
    request.onsuccess = () => resolve((request.result as PersistedVault | undefined) ?? null)
    request.onerror = () => reject(request.error ?? new Error('Could not read browser key vault.'))
    transaction.oncomplete = () => database.close()
    transaction.onerror = () => {
      database.close()
      reject(transaction.error ?? new Error('Could not read browser key vault.'))
    }
  })
}

async function writePersistedVault(record: PersistedVault) {
  const database = await openVaultDatabase()
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).put(record)
    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error ?? new Error('Could not persist browser key vault.'))
    }
  })
}

async function exportJwk(key: CryptoKey) {
  return crypto.subtle.exportKey('jwk', key)
}

function publicPayload(publicJwk: JsonWebKey) {
  return JSON.stringify(publicJwk)
}

async function importIdentityPrivateKey(jwk: JsonWebKey) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])
}

async function importIdentityPublicKey(jwk: JsonWebKey) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify'])
}

export async function importWrappingPrivateKey(jwk: JsonWebKey) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
}

export async function importWrappingPublicKey(jwk: JsonWebKey) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, [])
}

async function generateIdentityKeyPair() {
  return crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as Promise<CryptoKeyPair>
}

async function generateWrappingKeyPair() {
  return crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as Promise<CryptoKeyPair>
}

async function persistedToVault(record: PersistedVault): Promise<LocalVault> {
  const deviceIdentityPrivateKey = await importIdentityPrivateKey(record.deviceIdentityPrivateJwk)
  const deviceIdentityPublicKey = await importIdentityPublicKey(record.deviceIdentityPublicJwk)
  const deviceWrappingPrivateKey = await importWrappingPrivateKey(record.deviceWrappingPrivateJwk)
  const deviceWrappingPublicKey = await importWrappingPublicKey(record.deviceWrappingPublicJwk)
  const userDomainPrivateKey = record.userDomainPrivateJwk ? await importWrappingPrivateKey(record.userDomainPrivateJwk) : null
  const userDomainPublicKey = record.userDomainPublicJwk ? await importWrappingPublicKey(record.userDomainPublicJwk) : null

  return {
    createdAt: record.createdAt,
    deviceIdentityPrivateKey,
    deviceIdentityPublicKey,
    deviceWrappingPrivateKey,
    deviceWrappingPublicKey,
    userDomainPrivateKey,
    userDomainPublicKey,
    devicePublicIdentity: publicPayload(record.deviceIdentityPublicJwk),
    deviceWrappingPublicKeyPayload: publicPayload(record.deviceWrappingPublicJwk),
    userDomainPublicKeyPayload: record.userDomainPublicJwk ? publicPayload(record.userDomainPublicJwk) : null,
  }
}

export async function loadVault() {
  const record = await readPersistedVault()
  return record ? persistedToVault(record) : null
}

export async function createDeviceMaterial(options: { includeUserDomainKey?: boolean } = {}): Promise<DeviceMaterial> {
  const identityPair = await generateIdentityKeyPair()
  const wrappingPair = await generateWrappingKeyPair()
  const userDomainPair = options.includeUserDomainKey === false ? null : await generateWrappingKeyPair()
  const createdAt = new Date().toISOString()

  const record: PersistedVault = {
    id: currentRecordKey,
    createdAt,
    deviceIdentityPrivateJwk: await exportJwk(identityPair.privateKey),
    deviceIdentityPublicJwk: await exportJwk(identityPair.publicKey),
    deviceWrappingPrivateJwk: await exportJwk(wrappingPair.privateKey),
    deviceWrappingPublicJwk: await exportJwk(wrappingPair.publicKey),
    userDomainPrivateJwk: userDomainPair ? await exportJwk(userDomainPair.privateKey) : null,
    userDomainPublicJwk: userDomainPair ? await exportJwk(userDomainPair.publicKey) : null,
  }

  await writePersistedVault(record)

  return {
    devicePublicIdentity: publicPayload(record.deviceIdentityPublicJwk),
    deviceWrappingPublicKey: publicPayload(record.deviceWrappingPublicJwk),
    userDomainPublicKey: record.userDomainPublicJwk ? publicPayload(record.userDomainPublicJwk) : '',
    createdAt,
  }
}

export async function ensureDeviceMaterial(options: { includeUserDomainKey?: boolean } = {}) {
  const vault = await loadVault()
  if (vault) {
    return {
      devicePublicIdentity: vault.devicePublicIdentity,
      deviceWrappingPublicKey: vault.deviceWrappingPublicKeyPayload,
      userDomainPublicKey: vault.userDomainPublicKeyPayload ?? '',
      createdAt: vault.createdAt,
    }
  }

  return createDeviceMaterial(options)
}

export async function requireVault() {
  const vault = await loadVault()
  if (!vault) {
    throw new Error('This browser has no local E2EE key vault. Pair or recover this browser again.')
  }

  return vault
}

export async function requireUserDomainVault() {
  const vault = await requireVault()
  if (!vault.userDomainPrivateKey || !vault.userDomainPublicKey || !vault.userDomainPublicKeyPayload) {
    throw new Error('This browser is trusted but does not have local content keys. Pair it from an existing trusted browser.')
  }

  return vault as UserDomainVault
}

export async function exportUserDomainPrivateJwk() {
  const vault = await requireUserDomainVault()
  return crypto.subtle.exportKey('jwk', vault.userDomainPrivateKey)
}

export async function installUserDomainPrivateJwk(userDomainPrivateJwk: JsonWebKey) {
  const record = await readPersistedVault()
  if (!record) {
    throw new Error('Local browser key vault is missing.')
  }

  const privateKey = await importWrappingPrivateKey(userDomainPrivateJwk)
  const publicJwk = publicJwkFromPrivateJwk(userDomainPrivateJwk)

  record.userDomainPrivateJwk = await exportJwk(privateKey)
  record.userDomainPublicJwk = publicJwk
  await writePersistedVault(record)
}

function publicJwkFromPrivateJwk(privateJwk: JsonWebKey): JsonWebKey {
  const publicFields: JsonWebKey = { ...privateJwk }
  delete publicFields.d
  delete publicFields.key_ops
  return {
    ...publicFields,
    key_ops: [],
  }
}

export function parsePublicKeyPayload(payload: string) {
  return JSON.parse(payload) as JsonWebKey
}

export async function deriveWrappingKey(privateKey: CryptoKey, publicKey: CryptoKey, info: string) {
  const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256)
  const hkdfMaterial = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: browserBytes(new Uint8Array(16)),
      info: new TextEncoder().encode(info),
    },
    hkdfMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptWithAesKey(key: CryptoKey, plaintext: Uint8Array, aad: string) {
  const nonce = randomBytes(12)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: browserBytes(nonce), additionalData: new TextEncoder().encode(aad) },
    key,
    browserBytes(plaintext),
  )

  return {
    nonce: bytesToBase64Url(nonce),
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
  }
}

export async function decryptWithAesKey(key: CryptoKey, envelope: { nonce: string; ciphertext: string }, aad: string) {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: browserBytes(base64UrlToBytes(envelope.nonce)),
      additionalData: new TextEncoder().encode(aad),
    },
    key,
    browserBytes(base64UrlToBytes(envelope.ciphertext)),
  )

  return new Uint8Array(plaintext)
}
