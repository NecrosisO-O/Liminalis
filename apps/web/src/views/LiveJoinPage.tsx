import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.ts'

export function LiveJoinPage() {
  const [sessionCode, setSessionCode] = useState('')

  const joinMutation = useMutation({
    mutationFn: () => api.joinLiveTransferSession(sessionCode),
  })

  return (
    <section className="workspace-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Live</p>
          <h2>Join live transfer</h2>
          <p className="muted">Join a live session by explicit code.</p>
        </div>
      </header>

      <section className="panel page-panel upload-form">
        <label className="field search-field">
          <span>Session code</span>
          <input value={sessionCode} onChange={(event) => setSessionCode(event.target.value)} />
        </label>

        <div className="button-row">
          <button className="primary-button" type="button" onClick={() => joinMutation.mutate()}>
            Join session
          </button>
        </div>

        {joinMutation.data ? (
          <div className="surface-card compact-card result-card">
            <p className="eyebrow">Joined</p>
            <p className="muted">The session is awaiting confirmation.</p>
            <Link className="secondary-button button-link-secondary" to={`/live/${String((joinMutation.data as { id?: string }).id ?? '')}`}>
              Open session
            </Link>
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
