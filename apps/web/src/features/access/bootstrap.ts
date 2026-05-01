import { useQuery } from '@tanstack/react-query'
import { api, ApiError, type BootstrapState } from '../../shared/api/client.ts'

export function useBootstrap() {
  return useQuery({
    queryKey: ['bootstrap'],
    queryFn: api.bootstrap,
    retry: false,
  })
}

export function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401
}

export function resolveBootstrapPath(state: BootstrapState, hasPendingRecoveryDisplay = false) {
  if (state.accountState === 'blocked') {
    return '/blocked'
  }

  if (state.accountState === 'waiting_approval') {
    return '/waiting'
  }

  if (hasPendingRecoveryDisplay) {
    return '/device/recovery/rotated-codes'
  }

  if (state.requiresFirstDeviceBootstrap) {
    return '/device/setup'
  }

  if (state.trustState === 'trusted') {
    return '/app'
  }

  return '/device/pair'
}
