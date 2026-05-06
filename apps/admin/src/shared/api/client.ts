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

export type OperationsSummary = {
  users: {
    totalUsers: number
    pendingUsers: number
    enabledUsers: number
    disabledUsers: number
  }
  invites: {
    activeInvites: number
    consumedInvites: number
  }
  objects: {
    sourceItems: number
    shares: number
    trustedDevices: number
  }
  storage: {
    uploadedCiphertextBytes: number
  }
}

export type AdminUser = {
  id: string
  username: string
  email: string | null
  role: 'ADMIN' | 'REGULAR_USER'
  admissionState: 'PENDING_APPROVAL' | 'APPROVED'
  enablementState: 'ENABLED' | 'DISABLED'
  storageQuotaBytes?: number | null
  devices?: Array<{ id: string; label?: string; trustState?: string }>
  createdAt?: string
}

export type Invite = {
  id: string
  code: string
  expiresAt: string
  consumedAt: string | null
  consumedById: string | null
  invalidatedAt: string | null
  createdAt: string
}

export type StorageUser = {
  userId: string
  username: string
  role: string
  admissionState: string
  enablementState: string
  storageUsedBytes: number
  storageQuotaBytes: number
  hasCustomQuota: boolean
}

export type PolicyBundle = {
  id: string
  levelName: ConfidentialityLevel
  bundleVersion: number
  isCurrent: boolean
  lifecycle: Record<string, boolean | number | string | null>
  shareAvailability: Record<string, boolean | number | string | null>
  userTargetedSharing: Record<string, boolean | number | string | null>
  passwordExtraction: Record<string, boolean | number | string | null>
  publicLinks: Record<string, boolean | number | string | null>
  liveTransfer: Record<string, boolean | number | string | null>
  createdAt: string
  updatedAt: string
}

export type PolicyState = {
  defaultConfidentialityLevel: ConfidentialityLevel
  currentBundles: PolicyBundle[]
}

export type InstanceSettings = {
  singletonKey: string
  defaultConfidentialityLevel: ConfidentialityLevel
  defaultStorageQuotaBytes: number
  publicOrigin: string | null
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

async function request<T>(input: string, init: RequestInit = {}) {
  const response = await fetch(input, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    ...init,
  })
  const contentType = response.headers.get('content-type') ?? ''
  const body = contentType.includes('application/json') ? await response.json().catch(() => null) : await response.text().catch(() => null)

  if (!response.ok) {
    throw new ApiError(messageFromBody(body, `Request failed with status ${response.status}`), response.status, body)
  }

  return body as T
}

export const api = {
  login(username: string, password: string) {
    return request<{ userId: string; username: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
  },

  logout() {
    return request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })
  },

  getOperationsSummary() {
    return request<OperationsSummary>('/api/admin/operations/summary')
  },

  listInvites() {
    return request<Invite[]>('/api/admin/invites')
  },

  createInvite(expiresInMinutes: number) {
    return request<Invite>('/api/admin/invites', {
      method: 'POST',
      body: JSON.stringify({ expiresInMinutes }),
    })
  },

  invalidateInvite(inviteId: string) {
    return request<Invite>('/api/admin/invites/invalidate', {
      method: 'POST',
      body: JSON.stringify({ inviteId }),
    })
  },

  listUsers() {
    return request<AdminUser[]>('/api/admin/users')
  },

  approveUser(userId: string) {
    return request<AdminUser>('/api/admin/users/approve', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
  },

  disableUser(userId: string) {
    return request<AdminUser>('/api/admin/users/disable', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
  },

  enableUser(userId: string) {
    return request<AdminUser>('/api/admin/users/enable', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
  },

  getStorageUsers() {
    return request<StorageUser[]>('/api/admin/operations/storage/users')
  },

  setStorageQuota(userId: string | null, quotaBytes: number | null) {
    return request<unknown>('/api/admin/operations/storage/quota', {
      method: 'POST',
      body: JSON.stringify({ userId: userId ?? undefined, quotaBytes: quotaBytes ?? undefined }),
    })
  },

  getInstanceSettings() {
    return request<InstanceSettings>('/api/admin/operations/settings')
  },

  updateInstanceSettings(input: { publicOrigin?: string | null; defaultStorageQuotaBytes?: number }) {
    return request<InstanceSettings>('/api/admin/operations/settings', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  getPolicyState() {
    return request<PolicyState>('/api/admin/policy')
  },

  getPolicyHistory(levelName: ConfidentialityLevel) {
    return request<PolicyBundle[]>(`/api/admin/policy/history/${levelName}`)
  },

  publishPolicy(input: {
    levelName: ConfidentialityLevel
    lifecycle: Record<string, boolean | number | string | null>
    shareAvailability: Record<string, boolean | number | string | null>
    userTargetedSharing: Record<string, boolean | number | string | null>
    passwordExtraction: Record<string, boolean | number | string | null>
    publicLinks: Record<string, boolean | number | string | null>
    liveTransfer: Record<string, boolean | number | string | null>
    defaultConfidentialityLevel?: ConfidentialityLevel
  }) {
    return request<PolicyBundle>('/api/admin/policy/publish', {
      method: 'POST',
      body: JSON.stringify({
        levelName: input.levelName,
        lifecycle: { value: input.lifecycle },
        shareAvailability: { value: input.shareAvailability },
        userTargetedSharing: { value: input.userTargetedSharing },
        passwordExtraction: { value: input.passwordExtraction },
        publicLinks: { value: input.publicLinks },
        liveTransfer: { value: input.liveTransfer },
        defaultConfidentialityLevel: input.defaultConfidentialityLevel,
      }),
    })
  },

  restorePolicyDefaults(defaultConfidentialityLevel?: ConfidentialityLevel) {
    return request<PolicyState>('/api/admin/policy/restore-defaults', {
      method: 'POST',
      body: JSON.stringify({ defaultConfidentialityLevel }),
    })
  },
}
