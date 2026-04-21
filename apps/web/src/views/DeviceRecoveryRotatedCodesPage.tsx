import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.ts'
import { usePendingRecoveryDisplayQuery } from '../hooks/usePendingRecoveryDisplayQuery.ts'

export function DeviceRecoveryRotatedCodesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const pendingDisplayQuery = usePendingRecoveryDisplayQuery(true)
  const [remaining, setRemaining] = useState(5)
  const [confirmed, setConfirmed] = useState(false)
  const pendingTrustedDeviceId = useMemo(
    () => sessionStorage.getItem('liminalis_pending_trusted_device_id'),
    [],
  )

  useEffect(() => {
    if (remaining <= 0) {
      return undefined
    }

    const timeout = window.setTimeout(() => setRemaining((current) => current - 1), 1000)
    return () => window.clearTimeout(timeout)
  }, [remaining])

  const acknowledgeMutation = useMutation({
    mutationFn: api.acknowledgeRecovery,
    onSuccess: async () => {
      sessionStorage.removeItem('liminalis_pending_trusted_device_id')
      await queryClient.invalidateQueries({ queryKey: ['bootstrap'] })
      await queryClient.invalidateQueries({ queryKey: ['recovery', 'pending-display'] })
      navigate('/app', { replace: true })
    },
  })

  if (pendingDisplayQuery.isLoading || !pendingDisplayQuery.data) {
    return (
      <section className="surface-card status-card">
        <p className="eyebrow">Recovery</p>
        <h2>Loading recovery codes</h2>
        <p className="muted">Checking the current interruption state.</p>
      </section>
    )
  }

  return (
    <section className="surface-card auth-card">
      <p className="eyebrow">Recovery</p>
      <h2>Save your recovery codes</h2>
      <p className="muted">
        Any one code from this set can recover the account on an untrusted browser.
      </p>

      <div className="recovery-code-list">
        {pendingDisplayQuery.data.recoveryCodes.map((code, index) => (
          <div key={code} className="recovery-code-card">
            <span>Recovery code {index + 1}</span>
            <strong>{code}</strong>
          </div>
        ))}
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <span>I have saved these recovery codes.</span>
      </label>

      <div className="button-row">
        <button
          className="primary-button"
          type="button"
          disabled={remaining > 0 || !confirmed || !pendingTrustedDeviceId || acknowledgeMutation.isPending}
          onClick={() => {
            if (pendingTrustedDeviceId) {
              acknowledgeMutation.mutate(pendingTrustedDeviceId)
            }
          }}
        >
          {remaining > 0 ? `Continue in ${remaining}s` : 'Continue to workspace'}
        </button>
      </div>
    </section>
  )
}
