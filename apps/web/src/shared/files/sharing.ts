import { api } from '../api/client.ts'
import {
  createPasswordWrappedSourceEnvelope,
  createPublicLinkWrappedSourceEnvelope,
  createRecipientWrappedSourceEnvelope,
  e2eeVersion,
  generatePublicLinkSecret,
  type SourceKeyEnvelope,
} from '../crypto/envelope.ts'

function randomExtractionPassword() {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, '0')).join('').slice(0, 24)
}

async function publicOrigin() {
  const settings = await api.getPublicInstanceSettings().catch(() => null)
  const configured = settings?.publicOrigin?.trim()
  return (configured || window.location.origin).replace(/\/+$/u, '')
}

export async function ownerSourceEnvelope(sourceItemId: string) {
  const attempt = await api.issueSourceItemRetrieval(sourceItemId, `share-package-${sourceItemId}`)
  return attempt.wrappedPayloadReference as SourceKeyEnvelope
}

export async function createE2eeUserShare(input: {
  sourceItemId: string
  recipientUsername: string
  requestedValidityMinutes?: number
}) {
  const [sourceEnvelope, recipient] = await Promise.all([
    ownerSourceEnvelope(input.sourceItemId),
    api.getRecipientPublicKey(input.recipientUsername),
  ])
  const packageReference = await createRecipientWrappedSourceEnvelope(
    sourceEnvelope,
    recipient.userDomainPublicKey,
    `liminalis:${e2eeVersion}:share:${input.sourceItemId}:${recipient.recipientUserId}`,
  )

  return api.createShare({
    sourceItemId: input.sourceItemId,
    recipientUsername: input.recipientUsername,
    requestedValidityMinutes: input.requestedValidityMinutes,
    packageReference,
  })
}

export async function createE2eeExtraction(input: {
  sourceItemId: string
  password?: string
  requestedValidityMinutes?: number
  requestedRetrievalCount?: number
}) {
  const password = input.password?.trim() || randomExtractionPassword()
  const sourceEnvelope = await ownerSourceEnvelope(input.sourceItemId)
  const packageReference = await createPasswordWrappedSourceEnvelope(
    sourceEnvelope,
    password,
    `liminalis:${e2eeVersion}:extraction:${input.sourceItemId}`,
  )

  const [created, origin] = await Promise.all([
    api.createExtraction({
      sourceItemId: input.sourceItemId,
      password,
      requestedValidityMinutes: input.requestedValidityMinutes,
      requestedRetrievalCount: input.requestedRetrievalCount,
      packageReference,
    }),
    publicOrigin(),
  ])

  return {
    ...created,
    sourceItemId: input.sourceItemId,
    publicUrl: `${origin}/x/${created.entryToken}`,
  }
}

export async function createE2eePublicLink(input: {
  sourceItemId: string
  requestedValidityMinutes?: number
  requestedDownloadCount?: number
}) {
  const secret = generatePublicLinkSecret()
  const sourceEnvelope = await ownerSourceEnvelope(input.sourceItemId)
  const packageReference = await createPublicLinkWrappedSourceEnvelope(
    sourceEnvelope,
    secret,
    `liminalis:${e2eeVersion}:public-link:${input.sourceItemId}`,
  )
  const created = await api.createPublicLink({
    sourceItemId: input.sourceItemId,
    requestedValidityMinutes: input.requestedValidityMinutes,
    requestedDownloadCount: input.requestedDownloadCount,
    packageReference,
  })

  const origin = await publicOrigin()

  return {
    ...created,
    publicUrl: `${origin}/p/${created.linkToken}#k=${secret}`,
  }
}
