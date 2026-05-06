import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { api } from '../../shared/api/client.ts'
import { createDeviceMaterial, ensureDeviceMaterial } from '../../shared/crypto/device.ts'
import { createPairingApprovalPackage, installPairingApprovalPackage } from '../../shared/crypto/envelope.ts'
import { Button, Field, StatusView, TextInput } from '../../shared/ui/components.tsx'
import { useBootstrap } from '../access/bootstrap.ts'

const pendingTrustedDeviceStorageKey = 'liminalis_pending_trusted_device_id'

export function DeviceSetupPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [deviceLabel, setDeviceLabel] = useState('This browser')

  const setup = useMutation({
    mutationFn: async () => {
      const material = await createDeviceMaterial({ includeUserDomainKey: true })
      return api.bootstrapFirstDevice({
        deviceLabel,
        devicePublicIdentity: material.devicePublicIdentity,
        deviceWrappingPublicKey: material.deviceWrappingPublicKey,
        userDomainPublicKey: material.userDomainPublicKey,
      })
    },
    onSuccess: async (result) => {
      sessionStorage.setItem(pendingTrustedDeviceStorageKey, result.trustedDeviceId)
      await queryClient.invalidateQueries({ queryKey: ['bootstrap'] })
      await queryClient.invalidateQueries({ queryKey: ['recovery', 'pending-display'] })
      navigate('/device/recovery/rotated-codes', { replace: true })
    },
  })

  return (
    <main className="entry-screen">
      <section className="entry-panel">
        <p className="eyebrow">Trust</p>
        <h1>Trust this browser</h1>
        <p className="muted">This first trusted browser will receive recovery codes before workspace access opens.</p>
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault()
            setup.mutate()
          }}
        >
          <Field label="Device name" error={setup.error instanceof Error ? setup.error.message : null}>
            <TextInput value={deviceLabel} onChange={(event) => setDeviceLabel(event.target.value)} required />
          </Field>
          <Button variant="primary" type="submit" disabled={setup.isPending}>
            {setup.isPending ? 'Creating trusted device' : 'Trust browser'}
          </Button>
        </form>
      </section>
    </main>
  )
}

export function DevicePairPage() {
  const navigate = useNavigate()
  const [deviceLabel, setDeviceLabel] = useState('This browser')

  const pair = useMutation({
    mutationFn: async () => {
      const material = await ensureDeviceMaterial({ includeUserDomainKey: false })
      return api.createPairingSession({
        deviceLabel,
        devicePublicIdentity: material.devicePublicIdentity,
        deviceWrappingPublicKey: material.deviceWrappingPublicKey,
      })
    },
    onSuccess: (session) => {
      navigate(`/device/pair/waiting?pairingSessionId=${encodeURIComponent(session.id)}`, { replace: true })
    },
  })

  return (
    <main className="entry-screen">
      <section className="entry-panel">
        <p className="eyebrow">Trust</p>
        <h1>Pair this browser</h1>
        <p className="muted">Approve this browser from one of your trusted devices, using the code shown after pairing starts.</p>
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault()
            pair.mutate()
          }}
        >
          <Field label="Device name" error={pair.error instanceof Error ? pair.error.message : null}>
            <TextInput value={deviceLabel} onChange={(event) => setDeviceLabel(event.target.value)} required />
          </Field>
          <Button variant="primary" type="submit" disabled={pair.isPending}>
            {pair.isPending ? 'Starting pairing' : 'Start pairing'}
          </Button>
        </form>
        <Link to="/device/recovery">Use recovery code instead</Link>
      </section>
    </main>
  )
}

export function DevicePairWaitingPage() {
  const [searchParams] = useSearchParams()
  const pairingSessionId = searchParams.get('pairingSessionId') ?? ''
  const queryClient = useQueryClient()
  const session = useQuery({
    queryKey: ['trust', 'pairing', pairingSessionId],
    queryFn: () => api.getPairingSession(pairingSessionId),
    enabled: pairingSessionId !== '',
    refetchInterval: 2500,
    retry: false,
  })

  const finalize = useMutation({
    mutationFn: async () => {
      if (!session.data?.approvalPackage) {
        throw new Error('Approval package has not arrived yet.')
      }

      await installPairingApprovalPackage(session.data.approvalPackage)
      return api.finalizePairing(pairingSessionId)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bootstrap'] })
      window.location.assign('/app')
    },
  })

  return (
    <main className="entry-screen">
      <section className="entry-panel">
        <p className="eyebrow">Pairing</p>
        <h1>{session.data?.state === 'TRUSTED' ? 'Browser trusted' : session.data?.approvalPackage ? 'Approval received' : 'Awaiting approval'}</h1>
        <p className="muted">Open the approval screen on an existing trusted browser and verify this short code.</p>
        {session.data ? (
          <div className="code-panel">
            <span>Short code</span>
            <strong>{session.data.shortCode}</strong>
          </div>
        ) : null}
        <div className="actions">
          {session.data?.approvalPackage && session.data.state !== 'TRUSTED' ? (
            <Button variant="primary" onClick={() => finalize.mutate()} disabled={finalize.isPending}>
              Trust locally and open workspace
            </Button>
          ) : null}
          {session.data?.state === 'TRUSTED' ? <Link className="button button-primary" to="/app">Open workspace</Link> : null}
        </div>
        {finalize.error instanceof Error ? <p className="field-error">{finalize.error.message}</p> : null}
      </section>
    </main>
  )
}

export function DevicePairApprovePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryCode = searchParams.get('code') ?? ''
  const querySessionId = searchParams.get('pairingSessionId') ?? ''
  const queryClient = useQueryClient()
  const bootstrap = useBootstrap()
  const [shortCode, setShortCode] = useState(queryCode)
  const [resolvedSessionId] = useState(querySessionId)
  const canApprove = bootstrap.data?.accountState === 'active' && bootstrap.data.trustState === 'trusted'

  const resolved = useQuery({
    queryKey: ['trust', 'pairing-approval', shortCode, resolvedSessionId],
    queryFn: () => (resolvedSessionId ? api.getPairingSession(resolvedSessionId) : api.resolvePairingByShortCode(shortCode.trim())),
    enabled: canApprove && (resolvedSessionId !== '' || shortCode.trim() !== ''),
    retry: false,
  })

  const approve = useMutation({
    mutationFn: async (pairingSessionId: string) => {
      const requesterWrappingKey = resolved.data?.requesterDevice?.deviceWrappingPublicKey
      if (!requesterWrappingKey) {
        throw new Error('Requester browser has no wrapping public key.')
      }

      const approvalPackage = await createPairingApprovalPackage(requesterWrappingKey)
      return api.approvePairing(pairingSessionId, approvalPackage)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['trust'] })
      navigate('/app/settings', { replace: true })
    },
  })

  const reject = useMutation({
    mutationFn: api.rejectPairing,
    onSuccess: async () => {
      await resolved.refetch()
    },
  })

  if (bootstrap.isLoading) {
    return (
      <main className="entry-screen">
        <StatusView eyebrow="Trust" title="Checking this browser" detail="Only an existing trusted browser can approve a new pairing request." />
      </main>
    )
  }

  if (!canApprove) {
    return (
      <main className="entry-screen">
        <StatusView
          eyebrow="Trust"
          title="Use an existing trusted browser"
          detail="This approval screen is only available from a browser that is already trusted on this account."
        />
      </main>
    )
  }

  return (
    <main className="entry-screen">
      <section className="entry-panel">
        <p className="eyebrow">Trust</p>
        <h1>Approve browser</h1>
        <div className="form-stack">
          <Field label="Short code">
            <TextInput value={shortCode} onChange={(event) => setShortCode(event.target.value.toUpperCase())} placeholder="Enter code" />
          </Field>
          {resolved.data ? (
            <div className="detail-list">
              <div>
                <span>Device</span>
                <strong>{resolved.data.requesterDevice?.label ?? 'Unknown browser'}</strong>
              </div>
              <div>
                <span>State</span>
                <strong>{resolved.data.state}</strong>
              </div>
            </div>
          ) : null}
          {resolved.error instanceof Error ? <p className="field-error">{resolved.error.message}</p> : null}
          <div className="actions">
            <Button variant="primary" disabled={!resolved.data || approve.isPending} onClick={() => resolved.data && approve.mutate(resolved.data.id)}>
              Approve
            </Button>
            <Button variant="secondary" disabled={!resolved.data || reject.isPending} onClick={() => resolved.data && reject.mutate(resolved.data.id)}>
              Reject
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}

export function DeviceRecoveryPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [recoveryCode, setRecoveryCode] = useState('')
  const [deviceLabel, setDeviceLabel] = useState('Recovery browser')

  const recovery = useMutation({
    mutationFn: async () => {
      const material = await createDeviceMaterial({ includeUserDomainKey: true })
      return api.recoveryAttempt({
        recoveryCode: recoveryCode.replaceAll('-', '').trim(),
        deviceLabel,
        devicePublicIdentity: material.devicePublicIdentity,
        deviceWrappingPublicKey: material.deviceWrappingPublicKey,
        userDomainPublicKey: material.userDomainPublicKey,
      })
    },
    onSuccess: async (result) => {
      sessionStorage.setItem(pendingTrustedDeviceStorageKey, result.pendingTrustedDeviceId)
      await queryClient.invalidateQueries({ queryKey: ['recovery', 'pending-display'] })
      navigate('/device/recovery/rotated-codes', { replace: true })
    },
  })

  return (
    <main className="entry-screen">
      <section className="entry-panel">
        <p className="eyebrow">Recovery</p>
        <h1>Recover trusted access</h1>
        <p className="muted">Use one recovery code to trust this browser and rotate the remaining set.</p>
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault()
            recovery.mutate()
          }}
        >
          <Field label="Recovery code">
            <TextInput value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value.toUpperCase())} required />
          </Field>
          <Field label="Device name" error={recovery.error instanceof Error ? recovery.error.message : null}>
            <TextInput value={deviceLabel} onChange={(event) => setDeviceLabel(event.target.value)} required />
          </Field>
          <Button variant="primary" type="submit" disabled={recovery.isPending}>
            {recovery.isPending ? 'Recovering' : 'Recover access'}
          </Button>
        </form>
      </section>
    </main>
  )
}

export function RecoveryCodesPage() {
  const queryClient = useQueryClient()
  const trustedDeviceId = useMemo(() => sessionStorage.getItem(pendingTrustedDeviceStorageKey), [])
  const codes = useQuery({
    queryKey: ['recovery', 'pending-display'],
    queryFn: api.pendingRecoveryDisplay,
    retry: false,
  })

  const acknowledge = useMutation({
    mutationFn: async () => {
      if (!trustedDeviceId) {
        throw new Error('Trusted device context is missing.')
      }

      return api.acknowledgeRecovery(trustedDeviceId)
    },
    onSuccess: async () => {
      sessionStorage.removeItem(pendingTrustedDeviceStorageKey)
      await queryClient.invalidateQueries({ queryKey: ['bootstrap'] })
      window.location.assign('/app')
    },
  })

  if (codes.isLoading) {
    return (
      <main className="entry-screen">
        <StatusView title="Loading recovery codes" detail="Preparing your rotated recovery set." />
      </main>
    )
  }

  if (codes.isError || !codes.data) {
    return (
      <main className="entry-screen">
        <StatusView title="Recovery codes unavailable" detail="Sign in again or restart the trusted-device flow." tone="danger" />
      </main>
    )
  }

  return (
    <main className="entry-screen">
      <section className="entry-panel wide">
        <p className="eyebrow">Recovery</p>
        <h1>Save these recovery codes</h1>
        <p className="muted">They are shown once before the workspace opens.</p>
        <div className="recovery-grid">
          {codes.data.recoveryCodes.map((code) => (
            <code key={code}>{code}</code>
          ))}
        </div>
        {acknowledge.error instanceof Error ? <p className="field-error">{acknowledge.error.message}</p> : null}
        <Button variant="primary" onClick={() => acknowledge.mutate()} disabled={acknowledge.isPending}>
          I saved them
        </Button>
      </section>
    </main>
  )
}
