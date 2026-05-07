import { useQuery } from '@tanstack/react-query'
import { api, ApiError, type BootstrapState } from '../../shared/api/client.ts'
import { loadVault, signTrustedDeviceResumeChallenge } from '../../shared/crypto/vault.ts'

async function resumeTrustedBrowserIfPossible(state: BootstrapState) {
  if (
    state.accountState !== 'active' ||
    state.trustState !== 'untrusted' ||
    state.requiresFirstDeviceBootstrap
  ) {
    return state
  }

  const vault = await loadVault().catch(() => null)
  if (!vault?.devicePublicIdentity || !vault.userDomainPrivateKey) {
    return state
  }

  try {
    const challenge = await api.createTrustedDeviceResumeChallenge({
      devicePublicIdentity: vault.devicePublicIdentity,
    })
    const signature = await signTrustedDeviceResumeChallenge(challenge.challenge)
    await api.completeTrustedDeviceResume({
      challengeId: challenge.challengeId,
      signature,
    })
    return api.bootstrap()
  } catch {
    return state
  }
}

export async function bootstrapWithTrustedDeviceResume() {
  const state = await api.bootstrap()
  return resumeTrustedBrowserIfPossible(state)
}

export function useBootstrap() {
  return useQuery({
    queryKey: ['bootstrap'],
    queryFn: bootstrapWithTrustedDeviceResume,
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
