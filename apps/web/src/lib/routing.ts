import type { BootstrapState } from './api.ts'

export function resolveBootstrapPath(
  state: BootstrapState,
  options?: { hasPendingRecoveryDisplay?: boolean },
): string {
  if (state.accountState === 'blocked') {
    return '/blocked'
  }

  if (state.accountState === 'waiting_approval') {
    return '/waiting'
  }

  if (options?.hasPendingRecoveryDisplay) {
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
