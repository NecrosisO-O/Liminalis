export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export type ConfidentialityLevel = 'SECRET' | 'CONFIDENTIAL' | 'TOP_SECRET'
export type UploadContentKind = 'SINGLE_FILE' | 'GROUPED_CONTENT' | 'SELF_SPACE_TEXT'
export type GroupStructureKind = 'MULTI_FILE' | 'FOLDER'

export type BootstrapState = {
  accountState: 'active' | 'blocked' | 'waiting_approval'
  trustState: 'none' | 'untrusted' | 'trusted'
  requiresFirstDeviceBootstrap: boolean
  hasRecoverySet?: boolean
  hasCurrentWrappingKey?: boolean
}

export type PairingSessionState = {
  id: string
  requesterDeviceId: string
  approverDeviceId: string | null
  qrToken: string
  shortCode: string
  state: 'AWAITING_PAIR' | 'AWAITING_APPROVAL' | 'TRUSTED' | 'REJECTED' | 'EXPIRED'
  approvedAt: string | null
  rejectedAt: string | null
  expiresAt: string
  approvalPackage?: unknown
  requesterDevice?: {
    id: string
    userId: string
    label: string
    publicIdentityPayload: string | null
    deviceWrappingPublicKey?: string | null
  }
}

export type TimelineItem = {
  id: string
  sourceObjectType: 'SOURCE_ITEM' | 'SHARE_OBJECT'
  sourceObjectId: string
  timelineOrigin: 'CURRENT_DEVICE' | 'OTHER_DEVICE' | 'INCOMING_SHARE'
  sourceItemId?: string | null
  shareObjectId?: string | null
  displayTitle: string | null
  visibleTypeLabel: string
  visibleSizeBytes?: number | null
  groupedItemCount?: number | null
  sourceLabel: string
  activeStatusLabel: string
  confidentialityLevel: ConfidentialityLevel
  currentRetrievable: boolean
  visibleSummary?: string | null
  encryptedMetadata?: unknown
  createdTime: string
  validUntil?: string | null
}

export type HistoryEntry = {
  id: string
  sourceObjectType: 'SOURCE_ITEM' | 'SHARE_OBJECT'
  sourceObjectId: string
  sourceItemId?: string | null
  shareObjectId?: string | null
  displayTitle: string | null
  visibleTypeLabel: string
  sourceLabel: string
  confidentialityLevel: ConfidentialityLevel
  retainedStatus: string
  retrievable: boolean
  concreteReason: string | null
  visibleSummary?: string | null
  encryptedMetadata?: unknown
  createdTime: string
  statusTime?: string | null
  sourceItem?: { validUntil: string | null } | null
  shareObject?: { validUntil: string | null } | null
}

export type SearchDocument = {
  id: string
  sourceObjectType: 'SOURCE_ITEM' | 'SHARE_OBJECT'
  sourceObjectId: string
  sourceItemId?: string | null
  shareObjectId?: string | null
  displayTitle: string | null
  visibleSummary: string | null
  sourceLabel: string
  visibleTypeLabel: string
  visibleStatusLabel: string
  confidentialityLevel: ConfidentialityLevel
  retrievable: boolean
  updatedAt: string
}

export type SourceItemDetail = {
  id: string
  ownerUserId: string
  contentKind: UploadContentKind
  groupStructureKind: GroupStructureKind | null
  confidentialityLevel: ConfidentialityLevel
  state: 'ACTIVE' | 'INVALIDATED' | 'EXPIRED' | 'PURGED'
  displayName: string | null
  textCiphertextBody: string | null
  cryptoVersion?: string | null
  encryptedMetadata?: unknown
  contentCryptoMetadata?: unknown
  storageBytes: number
  validUntil: string | null
  burnAfterReadEnabled: boolean
  groupManifest?: {
    structureKind?: string | null
    itemCount?: number | null
    manifest?: unknown
  } | null
  createdAt: string
  updatedAt: string
}

export type PrepareUploadInput = {
  contentKind: UploadContentKind
  groupStructureKind?: GroupStructureKind
  confidentialityLevel?: ConfidentialityLevel
  requestedValidityMinutes?: number
  burnAfterReadEnabled?: boolean
  displayName?: string
  manifest?: Record<string, unknown>
  cryptoVersion?: string
}

export type PrepareUploadResult = {
  uploadSessionId: string
  contentKind: UploadContentKind
  confidentialityLevel: ConfidentialityLevel
  resolvedValidityMinutes: number | null
  expiresAt: string
  policySnapshot?: unknown
}

export type UploadPartResult = {
  uploadPartId: string
  partNumber: number
  storageKey: string
  byteSize: number
  checksum: string | null
}

export type FinalizeUploadInput = {
  displayName?: string
  textCiphertextBody?: string
  manifest?: Record<string, unknown>
  cryptoVersion?: string
  encryptedMetadata?: Record<string, unknown>
  contentCryptoMetadata?: Record<string, unknown>
  ownerKeyEnvelope?: Record<string, unknown>
}

export type FinalizeUploadResult = {
  sourceItemId: string
  contentKind: UploadContentKind
  state: string
  validUntil: string | null
}

export type RetrievalIssueResult = {
  retrievalAttemptId: string
  packageReferenceId: string
  packageFamilyKind: string
  wrappedPayloadReference: unknown
  sourceItemId?: string
  storageBinding?: unknown
  textCiphertextBody?: string | null
  encryptedMetadata?: unknown
  contentCryptoMetadata?: unknown
  contentKind: UploadContentKind
  expiresAt: string
}

export type CompletionResult = {
  retrievalAttemptId: string
  status: string
  sourceItemState?: string | null
  shareState?: string | null
  extractionState?: string | null
  remainingRetrievalCount?: number
  inactiveReason?: string | null
}

export type ShareCreationResult = {
  shareObjectId: string
  recipientUserId: string
  allowRepeatDownload: boolean
  allowRecipientMultiDeviceAccess: boolean
  validUntil: string | null
  packageReference?: unknown
}

export type IncomingShare = {
  id: string
  sourceItemId: string
  ownerUserId: string
  recipientUserId: string
  confidentialityLevel: ConfidentialityLevel
  state: string
  validUntil: string | null
  allowRepeatDownload: boolean
  allowRecipientMultiDeviceAccess: boolean
  burnAfterReadEnabled: boolean
  createdAt: string
  updatedAt: string
}

export type RecipientPublicKey = {
  recipientUserId: string
  username: string
  userDomainPublicKey: string
  keyVersion: number
}

export type ExtractionCreationResult = {
  extractionAccessId: string
  entryToken: string
  password: string
  remainingRetrievalCount: number
  validUntil: string | null
  requireSystemGeneratedPassword: boolean
  packageReference?: unknown
}

export type ExtractionEntry = {
  extractionAccessId: string
  state: string
  requiresCaptcha: boolean
  remainingRetrievalCount: number
  validUntil: string | null
  metadata: null
}

export type ExtractionUnlockResult = RetrievalIssueResult & {
  extractionAccessId: string
  metadata: {
    displayTitle: string
    senderUsername: string
    confidentialityLevel: ConfidentialityLevel
    contentKind: UploadContentKind
  }
  remainingRetrievalCount: number
}

export type PublicLinkCreationResult = {
  publicLinkId: string
  linkToken: string
  remainingDownloadCount: number
  validUntil: string | null
  packageReference?: unknown
}

export type PublicInstanceSettings = {
  publicOrigin: string | null
}

export type LiveTransferSession = {
  id?: string
  liveTransferSessionId?: string
  sessionCode: string | null
  state: string
  transportState?: string | null
  confidentialityLevel?: ConfidentialityLevel
  contentLabel: string
  contentKind: UploadContentKind
  groupedTransfer: boolean
  relayAllowed: boolean
  peerToPeerAllowed: boolean
  peerToPeerToRelayFallback: boolean
  liveToStoredFallbackAllowed: boolean
  retainRecord: boolean
  expiresAt: string
  initiatorConfirmedAt?: string | null
  joinerConfirmedAt?: string | null
}

export type LiveSignal = {
  id: string
  sessionId: string
  senderUserId: string
  senderDeviceId: string
  recipientUserId: string
  recipientDeviceId: string
  kind: string
  payload: Record<string, unknown>
  readAt: string | null
  createdAt: string
}

export type LiveRelayChunk = {
  id: string
  sessionId: string
  senderDeviceId: string
  recipientDeviceId: string
  sequence: number
  byteSize: number
  checksum: string | null
  receivedAt: string | null
  createdAt: string
}

export type LiveRecord = {
  id: string
  participantLabel: string
  sessionOutcome: string
  transportSummary: string | null
  contentLabel: string
  contentKind: UploadContentKind
  groupedTransfer: boolean
  startedAt: string
  endedAt: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function messageFromBody(body: unknown, fallback: string) {
  if (!isRecord(body) || !('message' in body)) {
    return fallback
  }

  const message = body.message
  if (typeof message === 'string') {
    return message
  }

  if (Array.isArray(message)) {
    return message.filter((entry): entry is string => typeof entry === 'string').join('; ')
  }

  return fallback
}

async function readBody(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return response.json().catch(() => null)
  }

  return response.text().catch(() => null)
}

async function requestJson<T>(input: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(input, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init.body instanceof Blob ? {} : { 'Content-Type': 'application/json' }),
      ...(init.headers ?? {}),
    },
  })

  const body = await readBody(response)
  if (!response.ok) {
    throw new ApiError(messageFromBody(body, `Request failed with status ${response.status}`), response.status, body)
  }

  return body as T
}

async function requestBlob(input: string, init: RequestInit = {}) {
  const response = await fetch(input, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init.headers ?? {}),
    },
  })

  if (!response.ok) {
    const body = await readBody(response)
    throw new ApiError(messageFromBody(body, `Request failed with status ${response.status}`), response.status, body)
  }

  return response
}

export function publicLinkDownloadUrl(linkToken: string) {
  return `/api/public-links/${encodeURIComponent(linkToken)}`
}

export function decodeResponseJsonHeader(response: Response, name: string) {
  const value = response.headers.get(name)
  if (!value) {
    return null
  }

  const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '='))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return JSON.parse(new TextDecoder().decode(bytes)) as unknown
}

export const api = {
  login(input: { username: string; password: string }) {
    return requestJson<{ userId: string; username: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  logout() {
    return requestJson<{ ok: boolean; sessionId: string | null }>('/api/auth/logout', { method: 'POST' })
  },

  register(input: { inviteCode: string; username: string; password: string; email?: string }) {
    return requestJson<{ id: string; username: string; admissionState: string; enablementState: string }>(
      '/api/registration/register',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    )
  },

  bootstrap() {
    return requestJson<BootstrapState>('/api/bootstrap')
  },

  getPublicInstanceSettings() {
    return requestJson<PublicInstanceSettings>('/api/instance/public-settings', {
      credentials: 'omit',
    })
  },

  bootstrapFirstDevice(input: { deviceLabel: string; userDomainPublicKey: string; devicePublicIdentity: string; deviceWrappingPublicKey: string }) {
    return requestJson<{ trustedDeviceId: string; recoveryCodes: string[] }>('/api/trust/bootstrap-first-device', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  createPairingSession(input: { deviceLabel: string; devicePublicIdentity: string; deviceWrappingPublicKey: string }) {
    return requestJson<PairingSessionState>('/api/trust/pairing-sessions', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  getPairingSession(pairingSessionId: string) {
    return requestJson<PairingSessionState>(`/api/trust/pairing-sessions/${encodeURIComponent(pairingSessionId)}`)
  },

  resolvePairingByShortCode(shortCode: string) {
    return requestJson<PairingSessionState>(`/api/trust/pairing/by-short-code/${encodeURIComponent(shortCode)}`)
  },

  approvePairing(pairingSessionId: string, approvalPackage: Record<string, unknown>) {
    return requestJson<PairingSessionState>('/api/trust/pairing/approve', {
      method: 'POST',
      body: JSON.stringify({ pairingSessionId, approvalPackage }),
    })
  },

  finalizePairing(pairingSessionId: string) {
    return requestJson<PairingSessionState>('/api/trust/pairing/finalize', {
      method: 'POST',
      body: JSON.stringify({ pairingSessionId }),
    })
  },

  rejectPairing(pairingSessionId: string) {
    return requestJson<PairingSessionState>('/api/trust/pairing/reject', {
      method: 'POST',
      body: JSON.stringify({ pairingSessionId }),
    })
  },

  recoveryAttempt(input: {
    recoveryCode: string
    deviceLabel: string
    devicePublicIdentity: string
    deviceWrappingPublicKey: string
    userDomainPublicKey?: string
  }) {
    return requestJson<{ pendingTrustedDeviceId: string; recoveryCodes: string[] }>('/api/recovery/attempt', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  pendingRecoveryDisplay() {
    return requestJson<{ recoveryCodes: string[] }>('/api/recovery/pending-display')
  },

  acknowledgeRecovery(trustedDeviceId: string) {
    return requestJson<{ ok?: boolean }>(`/api/recovery/acknowledge/${encodeURIComponent(trustedDeviceId)}`, {
      method: 'POST',
    })
  },

  getTimeline() {
    return requestJson<TimelineItem[]>('/api/timeline')
  },

  getHistory() {
    return requestJson<HistoryEntry[]>('/api/history')
  },

  search(query: string) {
    return requestJson<SearchDocument[]>(`/api/search?q=${encodeURIComponent(query)}`)
  },

  getSourceItem(sourceItemId: string) {
    return requestJson<SourceItemDetail>(`/api/source-items/${encodeURIComponent(sourceItemId)}`)
  },

  revokeSourceItem(sourceItemId: string) {
    return requestJson<SourceItemDetail>(`/api/source-items/${encodeURIComponent(sourceItemId)}/revoke`, {
      method: 'POST',
    })
  },

  changeConfidentiality(sourceItemId: string, confidentialityLevel: ConfidentialityLevel) {
    return requestJson<SourceItemDetail>(`/api/source-items/${encodeURIComponent(sourceItemId)}/confidentiality`, {
      method: 'POST',
      body: JSON.stringify({ confidentialityLevel }),
    })
  },

  updateValidity(sourceItemId: string, requestedValidityMinutes: number | null) {
    return requestJson<SourceItemDetail>(`/api/source-items/${encodeURIComponent(sourceItemId)}/validity`, {
      method: 'POST',
      body: JSON.stringify({ requestedValidityMinutes }),
    })
  },

  prepareUpload(input: PrepareUploadInput) {
    return requestJson<PrepareUploadResult>('/api/uploads/prepare', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  uploadPartBlob(uploadSessionId: string, partNumber: number, blob: Blob) {
    return requestJson<UploadPartResult>(
      `/api/uploads/${encodeURIComponent(uploadSessionId)}/parts/${partNumber}/blob`,
      {
        method: 'POST',
        body: blob,
        headers: { 'Content-Type': 'application/octet-stream' },
      },
    )
  },

  finalizeUpload(uploadSessionId: string, input: FinalizeUploadInput) {
    return requestJson<FinalizeUploadResult>(`/api/uploads/${encodeURIComponent(uploadSessionId)}/finalize`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  issueSourceItemRetrieval(sourceItemId: string, attemptScopeKey: string) {
    return requestJson<RetrievalIssueResult>(
      `/api/retrieval/source-items/${encodeURIComponent(sourceItemId)}/attempts/${encodeURIComponent(attemptScopeKey)}`,
      { method: 'POST' },
    )
  },

  completeRetrieval(retrievalAttemptId: string, success: boolean) {
    return requestJson<CompletionResult>(`/api/retrieval/attempts/${encodeURIComponent(retrievalAttemptId)}/complete`, {
      method: 'POST',
      body: JSON.stringify({ success }),
    })
  },

  downloadRetrieval(retrievalAttemptId: string) {
    return requestBlob(`/api/retrieval/attempts/${encodeURIComponent(retrievalAttemptId)}/download`)
  },

  createShare(input: {
    sourceItemId: string
    recipientUsername: string
    requestedValidityMinutes?: number
    packageReference?: Record<string, unknown>
  }) {
    return requestJson<ShareCreationResult>('/api/shares', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  getIncomingShares() {
    return requestJson<IncomingShare[]>('/api/shares/incoming')
  },

  getRecipientPublicKey(username: string) {
    return requestJson<RecipientPublicKey>(`/api/shares/recipient-key/${encodeURIComponent(username)}`)
  },

  issueShareRetrieval(shareObjectId: string, attemptScopeKey: string) {
    return requestJson<RetrievalIssueResult>(
      `/api/shares/${encodeURIComponent(shareObjectId)}/attempts/${encodeURIComponent(attemptScopeKey)}`,
      { method: 'POST' },
    )
  },

  completeShareRetrieval(retrievalAttemptId: string, success: boolean) {
    return requestJson<CompletionResult>(`/api/shares/attempts/${encodeURIComponent(retrievalAttemptId)}/complete`, {
      method: 'POST',
      body: JSON.stringify({ success }),
    })
  },

  createExtraction(input: {
    sourceItemId: string
    password?: string
    requestedValidityMinutes?: number
    requestedRetrievalCount?: number
    packageReference?: Record<string, unknown>
  }) {
    return requestJson<ExtractionCreationResult>('/api/extraction', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  getExtractionEntry(entryToken: string) {
    return requestJson<ExtractionEntry>(`/api/extraction/${encodeURIComponent(entryToken)}`)
  },

  submitExtractionPassword(entryToken: string, attemptScopeKey: string, password: string, captchaSatisfied?: boolean) {
    return requestJson<ExtractionUnlockResult>(
      `/api/extraction/${encodeURIComponent(entryToken)}/attempts/${encodeURIComponent(attemptScopeKey)}`,
      {
        method: 'POST',
        body: JSON.stringify({ password, captchaSatisfied }),
      },
    )
  },

  completeExtractionRetrieval(retrievalAttemptId: string, success: boolean) {
    return requestJson<CompletionResult>(`/api/extraction/attempts/${encodeURIComponent(retrievalAttemptId)}/complete`, {
      method: 'POST',
      body: JSON.stringify({ success }),
    })
  },

  downloadExtractionRetrieval(retrievalAttemptId: string) {
    return requestBlob(`/api/extraction/attempts/${encodeURIComponent(retrievalAttemptId)}/download`, {
      credentials: 'omit',
    })
  },

  createPublicLink(input: {
    sourceItemId: string
    requestedValidityMinutes?: number
    requestedDownloadCount?: number
    packageReference?: Record<string, unknown>
  }) {
    return requestJson<PublicLinkCreationResult>('/api/public-links', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  downloadPublicLink(linkToken: string) {
    return requestBlob(publicLinkDownloadUrl(linkToken), { credentials: 'omit' })
  },

  createLiveTransferSession(input: {
    contentLabel?: string
    contentKind: UploadContentKind
    confidentialityLevel?: ConfidentialityLevel
    groupedTransfer?: boolean
  }) {
    return requestJson<LiveTransferSession>('/api/live-transfer/sessions', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  joinLiveTransferSession(sessionCode: string) {
    return requestJson<LiveTransferSession>('/api/live-transfer/sessions/join', {
      method: 'POST',
      body: JSON.stringify({ sessionCode }),
    })
  },

  confirmLiveTransferSession(sessionId: string, confirmed: boolean) {
    return requestJson<LiveTransferSession>(`/api/live-transfer/sessions/${encodeURIComponent(sessionId)}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ confirmed }),
    })
  },

  updateLiveTransferTransport(sessionId: string, transportState: string) {
    return requestJson<LiveTransferSession>(`/api/live-transfer/sessions/${encodeURIComponent(sessionId)}/transport`, {
      method: 'POST',
      body: JSON.stringify({ transportState }),
    })
  },

  sendLiveSignal(sessionId: string, kind: string, payload: Record<string, unknown>) {
    return requestJson<LiveSignal>(`/api/live-transfer/sessions/${encodeURIComponent(sessionId)}/signals`, {
      method: 'POST',
      body: JSON.stringify({ kind, payload }),
    })
  },

  listLiveSignals(sessionId: string) {
    return requestJson<LiveSignal[]>(`/api/live-transfer/sessions/${encodeURIComponent(sessionId)}/signals`)
  },

  uploadLiveRelayChunk(sessionId: string, sequence: number, blob: Blob) {
    return requestJson<LiveRelayChunk>(
      `/api/live-transfer/sessions/${encodeURIComponent(sessionId)}/relay/chunks/${sequence}`,
      {
        method: 'POST',
        body: blob,
        headers: { 'Content-Type': 'application/octet-stream' },
      },
    )
  },

  listLiveRelayChunks(sessionId: string) {
    return requestJson<LiveRelayChunk[]>(`/api/live-transfer/sessions/${encodeURIComponent(sessionId)}/relay/chunks`)
  },

  downloadLiveRelayChunk(sessionId: string, chunkId: string) {
    return requestBlob(
      `/api/live-transfer/sessions/${encodeURIComponent(sessionId)}/relay/chunks/${encodeURIComponent(chunkId)}/blob`,
    )
  },

  acknowledgeLiveRelayChunk(sessionId: string, chunkId: string) {
    return requestJson<{ ok?: boolean }>(
      `/api/live-transfer/sessions/${encodeURIComponent(sessionId)}/relay/chunks/${encodeURIComponent(chunkId)}/ack`,
      { method: 'POST' },
    )
  },

  completeLiveTransferSession(sessionId: string) {
    return requestJson<LiveTransferSession>(`/api/live-transfer/sessions/${encodeURIComponent(sessionId)}/complete`, {
      method: 'POST',
    })
  },

  failLiveTransferSession(sessionId: string, reason: string) {
    return requestJson<LiveTransferSession>(`/api/live-transfer/sessions/${encodeURIComponent(sessionId)}/fail`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  },

  beginLiveStoredFallback(sessionId: string) {
    return requestJson<PrepareUploadResult>(`/api/live-transfer/sessions/${encodeURIComponent(sessionId)}/stored-fallback`, {
      method: 'POST',
    })
  },

  getLiveTransferSession(sessionId: string) {
    return requestJson<LiveTransferSession>(`/api/live-transfer/sessions/${encodeURIComponent(sessionId)}`)
  },

  listLiveTransferRecords() {
    return requestJson<LiveRecord[]>('/api/live-transfer/records')
  },
}

export { requestBlob }
