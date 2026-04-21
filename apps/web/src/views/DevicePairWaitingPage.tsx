import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api.ts'

export function DevicePairWaitingPage() {
  const [searchParams] = useSearchParams()
  const pairingSessionId = searchParams.get('pairingSessionId')

  const pairingQuery = useQuery({
    queryKey: ['trust', 'pairing-session', pairingSessionId],
    queryFn: () => api.getPairingSession(pairingSessionId ?? ''),
    enabled: pairingSessionId !== null,
    retry: false,
    refetchInterval: 2000,
  })

  if (!pairingSessionId) {
    return (
      <section className="surface-card status-card">
        <p className="eyebrow">Trust</p>
        <h2>Pairing session missing</h2>
        <p className="muted">Start a pairing request first.</p>
      </section>
    )
  }

  if (pairingQuery.isLoading || !pairingQuery.data) {
    return (
      <section className="surface-card status-card">
        <p className="eyebrow">Trust</p>
        <h2>Pairing in progress</h2>
        <p className="muted">Loading pairing session state.</p>
      </section>
    )
  }

  const session = pairingQuery.data

  return (
    <section className="surface-card auth-card">
      <p className="eyebrow">Trust</p>
      <h2>Pairing in progress</h2>
      <p className="muted">Use a trusted device to resolve and approve this pairing request.</p>

      <div className="detail-list mono-list">
        <div>
          <span>Session ID</span>
          <strong>{session.id}</strong>
        </div>
        <div>
          <span>QR token</span>
          <strong>{session.qrToken}</strong>
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
        <Link
          className="primary-button button-link"
          to={`/device/pair/approve?pairingSessionId=${session.id}`}
        >
          Open approval surface
        </Link>
        <Link className="secondary-button button-link-secondary" to="/device/recovery">
          Use recovery instead
        </Link>
      </div>
    </section>
  )
}
