import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.ts'

function makeOpaqueId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

export function DeviceRecoveryPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const devicePublicIdentity = useMemo(() => makeOpaqueId('device-public-identity'), [])
  const [deviceLabel, setDeviceLabel] = useState('Recovery browser')
  const [recoveryCode, setRecoveryCode] = useState('')

  const recoveryMutation = useMutation({
    mutationFn: api.recoveryAttempt,
    onSuccess: async (result) => {
      sessionStorage.setItem('liminalis_pending_trusted_device_id', result.pendingTrustedDeviceId)
      await queryClient.invalidateQueries({ queryKey: ['recovery', 'pending-display'] })
      navigate('/device/recovery/rotated-codes', { replace: true })
    },
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    recoveryMutation.mutate({
      recoveryCode: recoveryCode.replaceAll('-', '').trim(),
      deviceLabel,
      devicePublicIdentity,
    })
  }

  return (
    <section className="surface-card auth-card">
      <p className="eyebrow">Recovery</p>
      <h2>Recover trusted access</h2>
      <p className="muted">Use one recovery code to restore trusted access on this browser.</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Recovery code</span>
          <input
            value={recoveryCode}
            onChange={(event) => setRecoveryCode(event.target.value.toUpperCase())}
            required
            minLength={20}
          />
        </label>

        <label className="field">
          <span>Device name</span>
          <input value={deviceLabel} onChange={(event) => setDeviceLabel(event.target.value)} required />
        </label>

        <button className="primary-button" type="submit" disabled={recoveryMutation.isPending}>
          {recoveryMutation.isPending ? 'Recovering...' : 'Recover access'}
        </button>
      </form>
    </section>
  )
}
