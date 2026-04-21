import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ApiError, type BootstrapState } from '../lib/api.ts'
import { resolveBootstrapPath } from '../lib/routing.ts'
import { useBootstrapQuery } from '../hooks/useBootstrapQuery.ts'
import { usePendingRecoveryDisplayQuery } from '../hooks/usePendingRecoveryDisplayQuery.ts'

function ShellStatus({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="surface-card status-card">
      <p className="eyebrow">Liminalis</p>
      <h2>{title}</h2>
      <p className="muted">{detail}</p>
    </section>
  )
}

function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401
}

function isPendingRecoveryUnavailable(error: unknown) {
  return error instanceof ApiError && (error.status === 400 || error.status === 404)
}

function shouldAllowAccessPath(pathname: string, state: BootstrapState) {
  if (state.accountState === 'blocked') {
    return pathname === '/blocked'
  }

  if (state.accountState === 'waiting_approval') {
    return pathname === '/waiting'
  }

  if (state.requiresFirstDeviceBootstrap) {
    return pathname === '/device/setup'
  }

  if (pathname === '/device/recovery/rotated-codes') {
    return true
  }

  if (pathname === '/device/recovery') {
    return state.accountState === 'active'
  }

  if (pathname.startsWith('/device/pair')) {
    return state.accountState === 'active'
  }

  return pathname.startsWith('/device/')
}

type EntryRouteResolverProps = {
  fallback?: ReactNode
}

export function EntryRouteResolver({ fallback }: EntryRouteResolverProps) {
  const bootstrapQuery = useBootstrapQuery()
  const pendingRecoveryQuery = usePendingRecoveryDisplayQuery(bootstrapQuery.isSuccess)

  if (bootstrapQuery.isLoading) {
    return <ShellStatus title="Checking session" detail="Verifying current account access state." />
  }

  if (bootstrapQuery.isError) {
    if (isUnauthorized(bootstrapQuery.error)) {
      return fallback ?? <Outlet />
    }

    return <ShellStatus title="Unable to continue" detail="The current session state could not be checked." />
  }

  if (!bootstrapQuery.data) {
    return <ShellStatus title="Checking session" detail="Waiting for bootstrap state." />
  }

  if (pendingRecoveryQuery.isLoading) {
    return <ShellStatus title="Checking session" detail="Checking for pending recovery interruption." />
  }

  const hasPendingRecoveryDisplay = pendingRecoveryQuery.isSuccess

  return <Navigate to={resolveBootstrapPath(bootstrapQuery.data, { hasPendingRecoveryDisplay })} replace />
}

export function AccessRouteResolver() {
  const location = useLocation()
  const bootstrapQuery = useBootstrapQuery()
  const pendingRecoveryQuery = usePendingRecoveryDisplayQuery(bootstrapQuery.isSuccess)

  if (bootstrapQuery.isLoading) {
    return <ShellStatus title="Checking access state" detail="Resolving trust and admission state." />
  }

  if (bootstrapQuery.isError) {
    if (isUnauthorized(bootstrapQuery.error)) {
      return <Navigate to="/login" replace />
    }

    return <ShellStatus title="Unable to continue" detail="The current access state could not be checked." />
  }

  if (!bootstrapQuery.data) {
    return <ShellStatus title="Checking access state" detail="Waiting for bootstrap state." />
  }

  if (pendingRecoveryQuery.isLoading) {
    return <ShellStatus title="Checking access state" detail="Checking for pending recovery interruption." />
  }

  if (
    pendingRecoveryQuery.isError &&
    !isPendingRecoveryUnavailable(pendingRecoveryQuery.error) &&
    !isUnauthorized(pendingRecoveryQuery.error)
  ) {
    return <ShellStatus title="Unable to continue" detail="The recovery interruption state could not be checked." />
  }

  const hasPendingRecoveryDisplay = pendingRecoveryQuery.isSuccess

  if (shouldAllowAccessPath(location.pathname, bootstrapQuery.data)) {
    return <Outlet />
  }

  return <Navigate to={resolveBootstrapPath(bootstrapQuery.data, { hasPendingRecoveryDisplay })} replace />
}

export function WorkspaceRouteResolver() {
  const bootstrapQuery = useBootstrapQuery()
  const pendingRecoveryQuery = usePendingRecoveryDisplayQuery(bootstrapQuery.isSuccess)

  if (bootstrapQuery.isLoading) {
    return <ShellStatus title="Opening workspace" detail="Checking whether this browser can enter the trusted workspace." />
  }

  if (bootstrapQuery.isError) {
    if (isUnauthorized(bootstrapQuery.error)) {
      return <Navigate to="/login" replace />
    }

    return <ShellStatus title="Unable to continue" detail="The workspace entry state could not be checked." />
  }

  if (!bootstrapQuery.data) {
    return <ShellStatus title="Opening workspace" detail="Waiting for bootstrap state." />
  }

  if (pendingRecoveryQuery.isLoading) {
    return <ShellStatus title="Opening workspace" detail="Checking for recovery interruption." />
  }

  if (pendingRecoveryQuery.isSuccess) {
    return <Navigate to="/device/recovery/rotated-codes" replace />
  }

  if (bootstrapQuery.data.accountState === 'active' && bootstrapQuery.data.trustState === 'trusted') {
    return <Outlet />
  }

  return <Navigate to={resolveBootstrapPath(bootstrapQuery.data)} replace />
}
