import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.ts'

function makeOpaqueId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

export function DeviceSetupPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const generated = useMemo(
    () => ({
      devicePublicIdentity: makeOpaqueId('device-public-identity'),
      userDomainPublicKey: makeOpaqueId('user-domain-public-key'),
    }),
    [],
  )
  const [deviceLabel, setDeviceLabel] = useState('This browser')

  const setupMutation = useMutation({
    mutationFn: api.bootstrapFirstDevice,
    onSuccess: async (result) => {
      sessionStorage.setItem('liminalis_pending_trusted_device_id', result.trustedDeviceId)
      await queryClient.invalidateQueries({ queryKey: ['bootstrap'] })
      await queryClient.invalidateQueries({ queryKey: ['recovery', 'pending-display'] })
      navigate('/device/recovery/rotated-codes', { replace: true })
    },
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setupMutation.mutate({
      deviceLabel,
      devicePublicIdentity: generated.devicePublicIdentity,
      userDomainPublicKey: generated.userDomainPublicKey,
    })
  }

  return (
    <section className="surface-card auth-card">
      <p className="eyebrow">Trust</p>
      <h2>Trust this browser</h2>
      <p className="muted">
        Before you can use Liminalis normally, this browser needs to become your first trusted device.
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Device name</span>
          <input value={deviceLabel} onChange={(event) => setDeviceLabel(event.target.value)} required />
        </label>

        <button className="primary-button" type="submit" disabled={setupMutation.isPending}>
          {setupMutation.isPending ? 'Setting up device...' : 'Set up trusted device'}
        </button>
      </form>
    </section>
  )
}
