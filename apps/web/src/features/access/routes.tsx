import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { api, ApiError } from '../../shared/api/client.ts'
import { Button, Field, StatusView, TextInput } from '../../shared/ui/components.tsx'
import { bootstrapWithTrustedDeviceResume, isUnauthorized, resolveBootstrapPath, useBootstrap } from './bootstrap.ts'

function shouldCheckPendingRecovery(bootstrap: ReturnType<typeof useBootstrap>) {
  return Boolean(
    bootstrap.isSuccess &&
      bootstrap.data?.accountState === 'active' &&
      bootstrap.data.trustState === 'trusted' &&
      bootstrap.data.hasRecoverySet,
  )
}

function usePendingRecoveryDisplay(enabled: boolean) {
  return useQuery({
    queryKey: ['recovery', 'pending-display'],
    queryFn: api.pendingRecoveryDisplay,
    enabled,
    retry: false,
  })
}

export function EntryRoute() {
  const bootstrap = useBootstrap()
  const pendingRecovery = usePendingRecoveryDisplay(shouldCheckPendingRecovery(bootstrap))

  if (bootstrap.isLoading || pendingRecovery.isLoading) {
    return <StatusView eyebrow="Liminalis" title="Checking session" detail="Resolving account and trusted-device state." />
  }

  if (bootstrap.isError) {
    return isUnauthorized(bootstrap.error) ? <Outlet /> : <StatusView title="Unable to continue" detail="The session state could not be checked." tone="danger" />
  }

  if (!bootstrap.data) {
    return <StatusView title="Checking session" detail="Waiting for bootstrap state." />
  }

  return <Navigate to={resolveBootstrapPath(bootstrap.data, pendingRecovery.isSuccess)} replace />
}

export function AccessRoute() {
  const bootstrap = useBootstrap()
  const pendingRecovery = usePendingRecoveryDisplay(shouldCheckPendingRecovery(bootstrap))

  if (bootstrap.isLoading || pendingRecovery.isLoading) {
    return <StatusView eyebrow="Access" title="Opening Liminalis" detail="Resolving approval, enablement, and trusted-device state." />
  }

  if (bootstrap.isError) {
    return isUnauthorized(bootstrap.error) ? <Navigate to="/login" replace /> : <StatusView title="Unable to continue" detail="Access state could not be checked." tone="danger" />
  }

  if (!bootstrap.data) {
    return <StatusView title="Opening Liminalis" detail="Waiting for access state." />
  }

  return <Outlet />
}

export function WorkspaceGate() {
  const bootstrap = useBootstrap()
  const pendingRecovery = usePendingRecoveryDisplay(shouldCheckPendingRecovery(bootstrap))

  if (bootstrap.isLoading || pendingRecovery.isLoading) {
    return <StatusView eyebrow="Workspace" title="Checking trusted browser" detail="Protected transfer surfaces require a trusted device." />
  }

  if (bootstrap.isError) {
    return isUnauthorized(bootstrap.error) ? <Navigate to="/login" replace /> : <StatusView title="Unable to continue" detail="Workspace access could not be checked." tone="danger" />
  }

  if (pendingRecovery.isSuccess) {
    return <Navigate to="/device/recovery/rotated-codes" replace />
  }

  if (bootstrap.data?.accountState === 'active' && bootstrap.data.trustState === 'trusted') {
    return <Outlet />
  }

  return <Navigate to={bootstrap.data ? resolveBootstrapPath(bootstrap.data) : '/login'} replace />
}

export function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const login = useMutation({
    mutationFn: api.login,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bootstrap'] })
      const bootstrap = await bootstrapWithTrustedDeviceResume()
      navigate(resolveBootstrapPath(bootstrap), { replace: true })
    },
  })

  const error =
    login.error instanceof ApiError && login.error.status === 401
      ? 'Invalid username or password.'
      : login.error instanceof Error
        ? login.error.message
        : null

  return (
    <main className="entry-screen">
      <section className="entry-panel">
        <p className="eyebrow">Liminalis</p>
        <h1>Sign in</h1>
        <p className="muted">Enter this self-hosted transfer station from a browser you control.</p>
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault()
            login.mutate({ username, password })
          }}
        >
          <Field label="Username">
            <TextInput value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
          </Field>
          <Field label="Password" error={error}>
            <TextInput value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required />
          </Field>
          <Button variant="primary" type="submit" disabled={login.isPending}>
            {login.isPending ? 'Signing in' : 'Sign in'}
          </Button>
        </form>
        <p className="muted helper-row">
          Need access? <Link to="/register">Register with an invite</Link>
        </p>
      </section>
    </main>
  )
}

export function RegisterPage() {
  const [inviteCode, setInviteCode] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')

  const register = useMutation({
    mutationFn: api.register,
  })

  if (register.isSuccess) {
    return (
      <main className="entry-screen">
        <StatusView
          eyebrow="Registration"
          title="Account created"
          detail="An administrator must approve it before you can establish a trusted browser."
          actions={<Link className="button button-primary" to="/login">Return to sign in</Link>}
          tone="success"
        />
      </main>
    )
  }

  const error = register.error instanceof Error ? register.error.message : null

  return (
    <main className="entry-screen">
      <section className="entry-panel">
        <p className="eyebrow">Liminalis</p>
        <h1>Create account</h1>
        <p className="muted">Use an invite code from this instance administrator.</p>
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault()
            register.mutate({
              inviteCode,
              username,
              password,
              email: email.trim() === '' ? undefined : email,
            })
          }}
        >
          <Field label="Invite code">
            <TextInput value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} required />
          </Field>
          <Field label="Username">
            <TextInput value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
          </Field>
          <Field label="Password">
            <TextInput value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" required />
          </Field>
          <Field label="Email" hint="Optional">
            <TextInput value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
          </Field>
          {error ? <p className="field-error">{error}</p> : null}
          <Button variant="primary" type="submit" disabled={register.isPending}>
            {register.isPending ? 'Creating account' : 'Create account'}
          </Button>
        </form>
        <p className="muted helper-row">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  )
}

export function WaitingPage() {
  const bootstrap = useBootstrap()

  if (bootstrap.isLoading) {
    return (
      <main className="entry-screen">
        <StatusView eyebrow="Waiting" title="Checking approval" detail="Resolving the latest account state." />
      </main>
    )
  }

  if (bootstrap.isError) {
    return isUnauthorized(bootstrap.error) ? <Navigate to="/login" replace /> : (
      <main className="entry-screen">
        <StatusView title="Unable to continue" detail="The account state could not be checked." tone="danger" />
      </main>
    )
  }

  if (bootstrap.data && bootstrap.data.accountState !== 'waiting_approval') {
    return <Navigate to={resolveBootstrapPath(bootstrap.data)} replace />
  }

  return (
    <main className="entry-screen">
      <StatusView
        eyebrow="Waiting"
        title="Approval pending"
        detail="Your account exists, but an administrator has not approved it yet. Trusted-device setup starts only after approval."
      />
    </main>
  )
}

export function BlockedPage() {
  return (
    <main className="entry-screen">
      <StatusView
        eyebrow="Blocked"
        title="Account disabled"
        detail="This account cannot use transfer or admin surfaces with existing sessions or trusted devices."
        tone="danger"
      />
    </main>
  )
}
