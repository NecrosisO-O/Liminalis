import { useSearchParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.ts'

export function DevicePairApprovePage() {
  const [searchParams] = useSearchParams()
  const pairingSessionId = searchParams.get('pairingSessionId')
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const pairingQuery = useQuery({
    queryKey: ['trust', 'pairing-session', pairingSessionId],
    queryFn: () => api.getPairingSession(pairingSessionId ?? ''),
    enabled: pairingSessionId !== null,
    retry: false,
  })

  const approveMutation = useMutation({
    mutationFn: api.approvePairing,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bootstrap'] })
      navigate('/app', { replace: true })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: api.rejectPairing,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trust', 'pairing-session', pairingSessionId] })
    },
  })

  if (!pairingSessionId) {
    return (
      <section className="surface-card status-card">
        <p className="eyebrow">Trust</p>
        <h2>Approval target missing</h2>
        <p className="muted">Open the approval surface from an existing pairing session.</p>
      </section>
    )
  }

  if (pairingQuery.isLoading || !pairingQuery.data) {
    return (
      <section className="surface-card status-card">
        <p className="eyebrow">Trust</p>
        <h2>Loading approval context</h2>
        <p className="muted">Checking the pairing request.</p>
      </section>
    )
  }

  const session = pairingQuery.data

  return (
    <section className="surface-card auth-card">
      <p className="eyebrow">Trust</p>
      <h2>Approve pairing</h2>
      <p className="muted">Confirm this new browser before trusted access is granted.</p>

      <div className="detail-list">
        <div>
          <span>Device label</span>
          <strong>{session.requesterDevice?.label ?? 'Unknown device'}</strong>
        </div>
        <div>
          <span>Short code</span>
          <strong>{session.shortCode}</strong>
        </div>
        <div>
          <span>State</span>
          <strong>{session.state}</strong>
        </div>
      </div>

      <div className="button-row">
        <button
          className="primary-button"
          type="button"
          disabled={approveMutation.isPending || session.state !== 'AWAITING_PAIR'}
          onClick={() => approveMutation.mutate(pairingSessionId)}
        >
          Approve device
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={rejectMutation.isPending || session.state !== 'AWAITING_PAIR'}
          onClick={() => rejectMutation.mutate(pairingSessionId)}
        >
          Reject
        </button>
      </div>
    </section>
  )
}
