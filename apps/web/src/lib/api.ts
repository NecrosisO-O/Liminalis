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

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const contentType = response.headers.get('content-type')
  const body = contentType?.includes('application/json') ? await response.json() : null

  if (!response.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      (typeof body.message === 'string'
        ? body.message
        : Array.isArray(body.message)
          ? body.message.filter((entry: unknown): entry is string => typeof entry === 'string').join('; ')
          : `Request failed with status ${response.status}`)

    throw new ApiError(message, response.status, body)
  }

  return body as T
}

export type BootstrapState = {
  accountState: 'active' | 'blocked' | 'waiting_approval'
  trustState: 'none' | 'untrusted' | 'trusted'
  requiresFirstDeviceBootstrap: boolean
  hasRecoverySet?: boolean
  hasCurrentWrappingKey?: boolean
}

export type LoginInput = {
  username: string
  password: string
}

export type RegisterInput = {
  inviteCode: string
  username: string
  password: string
  email?: string
}

export type FirstDeviceBootstrapInput = {
  deviceLabel: string
  userDomainPublicKey: string
  devicePublicIdentity: string
}

export type PairingSessionInput = {
  deviceLabel: string
  devicePublicIdentity: string
}

export type PairingSessionState = {
  id: string
  requesterDeviceId: string
  approverDeviceId: string | null
  qrToken: string
  shortCode: string
  state: 'AWAITING_PAIR' | 'TRUSTED' | 'REJECTED' | 'EXPIRED'
  approvedAt: string | null
  rejectedAt: string | null
  expiresAt: string
  requesterDevice?: {
    id: string
    userId: string
    label: string
    publicIdentityPayload: string | null
  }
}

export type RecoveryAttemptInput = {
  recoveryCode: string
  deviceLabel: string
  devicePublicIdentity: string
}

export type TimelineItem = {
  id: string
  objectType: string
  objectId: string
  sourceObjectType?: string
  sourceObjectId?: string
  displayTitle: string | null
  visibleTypeLabel: string | null
  visibleSizeLabel: string | null
  groupedItemCount: number | null
  sourceLabel: string | null
  activeStatusLabel: string | null
  confidentialityLevel: 'SECRET' | 'CONFIDENTIAL' | 'TOP_SECRET'
  createdTime: string
  validUntil?: string | null
  currentRetrievable: boolean
  visibleSummary?: string | null
}

export type SourceItemDetail = {
  id: string
  displayName: string | null
  contentKind: string
  confidentialityLevel: 'SECRET' | 'CONFIDENTIAL' | 'TOP_SECRET'
  state: string
  validUntil: string | null
  createdAt: string
  updatedAt: string
  textCiphertextBody: string | null
  groupManifest?: {
    structureKind?: string | null
    itemCount?: number | null
  } | null
}

export type HistoryEntry = {
  id: string
  objectType?: string
  objectId?: string
  sourceObjectType?: string
  sourceObjectId?: string
  displayTitle: string | null
  visibleTypeLabel: string | null
  sourceLabel: string | null
  confidentialityLevel: 'SECRET' | 'CONFIDENTIAL' | 'TOP_SECRET'
  createdTime: string
  statusTime?: string | null
  retainedStatus: string | null
  retrievable: boolean
  concreteReason: string | null
  visibleSummary?: string | null
  sourceItem?: {
    validUntil: string | null
  } | null
  shareObject?: {
    validUntil: string | null
  } | null
}

export type SearchDocument = {
  id: string
  objectType: string
  objectId: string
  displayTitle: string | null
  visibleSummary: string | null
  sourceLabel: string | null
  visibleTypeLabel: string | null
  visibleStatusLabel: string | null
  updatedAt: string
}

export type PrepareUploadInput = {
  contentKind: 'SELF_SPACE_TEXT' | 'SINGLE_FILE' | 'GROUPED_CONTENT'
  groupStructureKind?: 'MULTI_FILE' | 'FOLDER'
  confidentialityLevel?: 'SECRET' | 'CONFIDENTIAL' | 'TOP_SECRET'
  requestedValidityMinutes?: number
  burnAfterReadEnabled?: boolean
  displayName?: string
}

export type FinalizeUploadInput = {
  displayName?: string
  textCiphertextBody?: string
  manifest?: Record<string, unknown>
}

export type RegisterUploadPartInput = {
  partNumber: number
  storageKey: string
  byteSize: number
  checksum?: string
}

export type ShareCreationInput = {
  sourceItemId: string
  recipientUsername: string
  requestedValidityMinutes?: number
}

export type ExtractionCreationInput = {
  shareObjectId: string
  password?: string
  requestedValidityMinutes?: number
  requestedRetrievalCount?: number
}

export type PublicLinkCreationInput = {
  shareObjectId: string
  requestedValidityMinutes?: number
  requestedDownloadCount?: number
}

export type LiveTransferCreateInput = {
  contentLabel: string
  contentKind: 'SINGLE_FILE' | 'GROUPED_CONTENT'
  confidentialityLevel?: 'SECRET' | 'CONFIDENTIAL' | 'TOP_SECRET'
  groupedTransfer?: boolean
}

export const api = {
  login(input: LoginInput) {
    return request<{ userId: string; username: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  logout() {
    return request<{ ok: boolean; sessionId: string | null }>('/api/auth/logout', {
      method: 'POST',
    })
  },

  register(input: RegisterInput) {
    return request<{
      id: string
      username: string
      admissionState: 'PENDING_APPROVAL'
      enablementState: 'ENABLED'
    }>('/api/registration/register', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  bootstrap() {
    return request<BootstrapState>('/api/bootstrap')
  },

  bootstrapFirstDevice(input: FirstDeviceBootstrapInput) {
    return request<{ trustedDeviceId: string; recoveryCodes: string[] }>('/api/trust/bootstrap-first-device', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  createPairingSession(input: PairingSessionInput) {
    return request<PairingSessionState>('/api/trust/pairing-sessions', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  getPairingSession(pairingSessionId: string) {
    return request<PairingSessionState>(`/api/trust/pairing-sessions/${pairingSessionId}`)
  },

  resolvePairingByShortCode(shortCode: string) {
    return request<PairingSessionState>(`/api/trust/pairing/by-short-code/${shortCode}`)
  },

  resolvePairingByQrToken(qrToken: string) {
    return request<PairingSessionState>(`/api/trust/pairing/by-qr/${qrToken}`)
  },

  approvePairing(pairingSessionId: string) {
    return request<PairingSessionState>('/api/trust/pairing/approve', {
      method: 'POST',
      body: JSON.stringify({ pairingSessionId }),
    })
  },

  rejectPairing(pairingSessionId: string) {
    return request<PairingSessionState>('/api/trust/pairing/reject', {
      method: 'POST',
      body: JSON.stringify({ pairingSessionId }),
    })
  },

  recoveryAttempt(input: RecoveryAttemptInput) {
    return request<{ pendingTrustedDeviceId: string; recoveryCodes: string[] }>('/api/recovery/attempt', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  pendingRecoveryDisplay() {
    return request<{ recoveryCodes: string[] }>('/api/recovery/pending-display')
  },

  acknowledgeRecovery(trustedDeviceId: string) {
    return request(`/api/recovery/acknowledge/${trustedDeviceId}`, {
      method: 'POST',
    })
  },

  getTimeline() {
    return request<TimelineItem[]>('/api/timeline')
  },

  getSourceItem(sourceItemId: string) {
    return request<SourceItemDetail>(`/api/source-items/${sourceItemId}`)
  },

  getHistory() {
    return request<HistoryEntry[]>('/api/history')
  },

  search(query: string) {
    return request<SearchDocument[]>(`/api/search?q=${encodeURIComponent(query)}`)
  },

  prepareUpload(input: PrepareUploadInput) {
    return request<{
      uploadSessionId: string
      contentKind: string
      confidentialityLevel: 'SECRET' | 'CONFIDENTIAL' | 'TOP_SECRET'
      resolvedValidityMinutes: number | null
      expiresAt: string
    }>('/api/uploads/prepare', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  registerUploadPart(uploadSessionId: string, input: RegisterUploadPartInput) {
    return request<{ ok: boolean }>(`/api/uploads/${uploadSessionId}/parts`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  finalizeUpload(uploadSessionId: string, input: FinalizeUploadInput) {
    return request<{
      sourceItemId: string
      contentKind: string
      state: string
      validUntil: string | null
    }>(`/api/uploads/${uploadSessionId}/finalize`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  createShare(input: ShareCreationInput) {
    return request<{
      shareObjectId: string
      recipientUserId: string
      allowRepeatDownload: boolean
      allowRecipientMultiDeviceAccess: boolean
      validUntil: string | null
    }>('/api/shares', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  getIncomingShares() {
    return request<Array<Record<string, unknown>>>('/api/shares/incoming')
  },

  createExtraction(input: ExtractionCreationInput) {
    return request<{
      extractionAccessId: string
      entryToken: string
      password: string
      remainingRetrievalCount: number
      validUntil: string | null
      requireSystemGeneratedPassword: boolean
    }>('/api/extraction', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  getExtractionEntry(entryToken: string) {
    return request<{
      extractionAccessId: string
      state: string
      requiresCaptcha: boolean
      remainingRetrievalCount: number
      validUntil: string | null
      metadata: {
        displayTitle: string
        senderUsername: string
        confidentialityLevel: string
        contentKind: string
      } | null
    }>(`/api/extraction/${entryToken}`)
  },

  submitExtractionPassword(entryToken: string, attemptScopeKey: string, password: string, captchaSatisfied?: boolean) {
    return request<{
      retrievalAttemptId: string
      extractionAccessId: string
      packageReferenceId: string
      packageFamilyKind: string
      sourceItemId: string
      textCiphertextBody: string | null
      contentKind: string
      expiresAt: string
      remainingRetrievalCount: number
    }>(`/api/extraction/${entryToken}/attempts/${attemptScopeKey}`, {
      method: 'POST',
      body: JSON.stringify({ password, captchaSatisfied }),
    })
  },

  completeExtractionRetrieval(retrievalAttemptId: string, success: boolean) {
    return request(`/api/extraction/attempts/${retrievalAttemptId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ success }),
    })
  },

  createPublicLink(input: PublicLinkCreationInput) {
    return request<{
      publicLinkId: string
      linkToken: string
      remainingDownloadCount: number
      validUntil: string | null
    }>('/api/public-links', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  getPublicLink(linkToken: string) {
    return request<{
      publicLinkId: string
      state: string
      validUntil: string | null
      remainingDownloadCount: number
    }>(`/api/public-links/${linkToken}`)
  },

  issuePublicLinkTicket(linkToken: string) {
    return request<{ ticketToken: string; expiresAt: string }>(`/api/public-links/${linkToken}/tickets`, {
      method: 'POST',
    })
  },

  redeemPublicLinkTicket(ticketToken: string) {
    return request<{
      publicLinkId: string
      state: string
      remainingDownloadCount: number
      sourceItemId: string
      storageBinding: unknown
      textCiphertextBody: string | null
      contentKind: string
    }>(`/api/public-links/tickets/${ticketToken}/redeem`, {
      method: 'POST',
    })
  },

  createLiveTransferSession(input: LiveTransferCreateInput) {
    return request<{
      liveTransferSessionId: string
      sessionCode: string
      state: string
      relayAllowed: boolean
      peerToPeerAllowed: boolean
      peerToPeerToRelayFallback: boolean
      liveToStoredFallbackAllowed: boolean
      retainRecord: boolean
      expiresAt: string
    }>('/api/live-transfer/sessions', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  joinLiveTransferSession(sessionCode: string) {
    return request('/api/live-transfer/sessions/join', {
      method: 'POST',
      body: JSON.stringify({ sessionCode }),
    })
  },

  confirmLiveTransferSession(sessionId: string, confirmed: boolean) {
    return request(`/api/live-transfer/sessions/${sessionId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ confirmed }),
    })
  },

  updateLiveTransferTransport(sessionId: string, transportState: string) {
    return request(`/api/live-transfer/sessions/${sessionId}/transport`, {
      method: 'POST',
      body: JSON.stringify({ transportState }),
    })
  },

  completeLiveTransferSession(sessionId: string) {
    return request(`/api/live-transfer/sessions/${sessionId}/complete`, {
      method: 'POST',
    })
  },

  failLiveTransferSession(sessionId: string, reason: string) {
    return request(`/api/live-transfer/sessions/${sessionId}/fail`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  },

  beginLiveToStoredFallback(sessionId: string) {
    return request(`/api/live-transfer/sessions/${sessionId}/stored-fallback`, {
      method: 'POST',
    })
  },

  getLiveTransferSession(sessionId: string) {
    return request<Record<string, unknown>>(`/api/live-transfer/sessions/${sessionId}`)
  },

  listLiveTransferRecords() {
    return request<Array<Record<string, unknown>>>('/api/live-transfer/records')
  },
}
