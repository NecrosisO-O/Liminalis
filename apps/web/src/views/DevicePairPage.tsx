import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api } from '../lib/api.ts'

function makeOpaqueId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

export function DevicePairPage() {
  const navigate = useNavigate()
  const devicePublicIdentity = useMemo(() => makeOpaqueId('device-public-identity'), [])
  const [deviceLabel, setDeviceLabel] = useState('This browser')

  const pairMutation = useMutation({
    mutationFn: api.createPairingSession,
    onSuccess: (session) => {
      navigate(`/device/pair/waiting?pairingSessionId=${session.id}`, { replace: true })
    },
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    pairMutation.mutate({
      deviceLabel,
      devicePublicIdentity,
    })
  }

  return (
    <section className="surface-card auth-card">
      <p className="eyebrow">Trust</p>
      <h2>Pair this browser</h2>
      <p className="muted">
        Use one of your existing trusted devices to approve protected access on this browser.
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Device name</span>
          <input value={deviceLabel} onChange={(event) => setDeviceLabel(event.target.value)} required />
        </label>

        <button className="primary-button" type="submit" disabled={pairMutation.isPending}>
          {pairMutation.isPending ? 'Starting pairing...' : 'Start pairing'}
        </button>
      </form>
    </section>
  )
}
