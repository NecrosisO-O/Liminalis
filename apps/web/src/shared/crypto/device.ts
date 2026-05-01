const storageKey = 'liminalis_device_material_v1'

export type DeviceMaterial = {
  devicePublicIdentity: string
  userDomainPublicKey: string
  createdAt: string
}

async function exportPublicKey(key: CryptoKey) {
  return JSON.stringify(await crypto.subtle.exportKey('jwk', key))
}

async function generateSigningPublicPayload() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['sign', 'verify'],
  )

  return exportPublicKey(keyPair.publicKey)
}

async function generateWrappingPublicPayload() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    ['deriveKey'],
  )

  return exportPublicKey(keyPair.publicKey)
}

export async function createDeviceMaterial(): Promise<DeviceMaterial> {
  const material = {
    devicePublicIdentity: await generateSigningPublicPayload(),
    userDomainPublicKey: await generateWrappingPublicPayload(),
    createdAt: new Date().toISOString(),
  }

  localStorage.setItem(storageKey, JSON.stringify(material))
  return material
}

export function loadDeviceMaterial(): DeviceMaterial | null {
  const raw = localStorage.getItem(storageKey)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DeviceMaterial>
    if (typeof parsed.devicePublicIdentity === 'string' && typeof parsed.userDomainPublicKey === 'string') {
      return {
        devicePublicIdentity: parsed.devicePublicIdentity,
        userDomainPublicKey: parsed.userDomainPublicKey,
        createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
      }
    }
  } catch {
    localStorage.removeItem(storageKey)
  }

  return null
}

export async function ensureDeviceMaterial() {
  return loadDeviceMaterial() ?? createDeviceMaterial()
}
