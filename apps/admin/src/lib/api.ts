export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
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
      typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string'
        ? body.message
        : `Request failed with status ${response.status}`
    throw new ApiError(message, response.status)
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
    return request('/api/auth/logout', {
      method: 'POST',
    })
  },

  getOperationsSummary() {
    return request<{
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
    }>('/api/admin/operations/summary')
  },

  listInvites() {
    return request<Array<Record<string, unknown>>>('/api/admin/invites')
  },

  createInvite(expiresInMinutes: number) {
    return request('/api/admin/invites', {
      method: 'POST',
      body: JSON.stringify({ expiresInMinutes }),
    })
  },

  invalidateInvite(inviteId: string) {
    return request('/api/admin/invites/invalidate', {
      method: 'POST',
      body: JSON.stringify({ inviteId }),
    })
  },

  listUsers() {
    return request<Array<Record<string, unknown>>>('/api/admin/users')
  },

  approveUser(userId: string) {
    return request('/api/admin/users/approve', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
  },

  disableUser(userId: string) {
    return request('/api/admin/users/disable', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
  },

  enableUser(userId: string) {
    return request('/api/admin/users/enable', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
  },

  getPolicyState() {
    return request<{
      defaultConfidentialityLevel: string
      currentBundles: Array<Record<string, unknown>>
    }>('/api/admin/policy')
  },

  getPolicyHistory(levelName: string) {
    return request<Array<Record<string, unknown>>>(`/api/admin/policy/history/${levelName}`)
  },
}
