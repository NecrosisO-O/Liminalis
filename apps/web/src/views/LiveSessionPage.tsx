import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../lib/api.ts'

export function LiveSessionPage() {
  const { sessionId } = useParams()

  const sessionQuery = useQuery({
    queryKey: ['live', 'session', sessionId],
    queryFn: () => api.getLiveTransferSession(sessionId ?? ''),
    enabled: Boolean(sessionId),
    retry: false,
    refetchInterval: 2000,
  })

  const confirmMutation = useMutation({
    mutationFn: (confirmed: boolean) => api.confirmLiveTransferSession(sessionId ?? '', confirmed),
  })

  const transportMutation = useMutation({
    mutationFn: (transportState: string) => api.updateLiveTransferTransport(sessionId ?? '', transportState),
  })

  const completeMutation = useMutation({
    mutationFn: () => api.completeLiveTransferSession(sessionId ?? ''),
  })

  const failMutation = useMutation({
    mutationFn: () => api.failLiveTransferSession(sessionId ?? '', 'manual failure from frontend'),
  })

  const fallbackMutation = useMutation({
    mutationFn: () => api.beginLiveToStoredFallback(sessionId ?? ''),
  })

  return (
    <section className="workspace-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Live</p>
          <h2>Live session</h2>
          <p className="muted">Separate live-transfer mode with explicit session state and fallback handling.</p>
        </div>
      </header>

      <section className="panel page-panel admin-section-grid">
        {sessionQuery.data ? (
          <div className="detail-list">
            <div>
              <span>State</span>
              <strong>{String(sessionQuery.data.state ?? 'unknown')}</strong>
            </div>
            <div>
              <span>Transport</span>
              <strong>{String(sessionQuery.data.transportState ?? 'pending')}</strong>
            </div>
            <div>
              <span>Session code</span>
              <strong>{String(sessionQuery.data.sessionCode ?? 'unknown')}</strong>
            </div>
          </div>
        ) : (
          <p className="muted">Loading live-transfer session.</p>
        )}

        <div className="button-row">
          <button className="primary-button" type="button" onClick={() => confirmMutation.mutate(true)}>
            Confirm
          </button>
          <button className="secondary-button" type="button" onClick={() => transportMutation.mutate('P2P_ATTEMPT')}>
            P2P attempt
          </button>
          <button className="secondary-button" type="button" onClick={() => transportMutation.mutate('RELAY_ATTEMPT')}>
            Relay attempt
          </button>
          <button className="secondary-button" type="button" onClick={() => completeMutation.mutate()}>
            Complete
          </button>
          <button className="secondary-button" type="button" onClick={() => failMutation.mutate()}>
            Fail
          </button>
          <button className="secondary-button" type="button" onClick={() => fallbackMutation.mutate()}>
            Switch to normal transfer
          </button>
        </div>

        {fallbackMutation.data ? (
          <div className="surface-card compact-card result-card">
            <p className="eyebrow">Stored fallback</p>
            <p className="muted">Stored-transfer handoff prepared for {String((fallbackMutation.data as { contentLabel?: string }).contentLabel ?? 'content')}.</p>
            <div className="button-row compact-actions">
              <Link className="secondary-button button-link-secondary" to="/app">
                Back to timeline
              </Link>
              <Link className="secondary-button button-link-secondary" to="/app/upload">
                Open upload surface
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      <div className="button-row left-actions">
        <Link className="secondary-button button-link-secondary" to="/app">
          Return to workspace
        </Link>
      </div>
    </section>
  )
}
