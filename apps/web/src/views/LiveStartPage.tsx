import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.ts'

const confidentialityOptions = ['SECRET', 'CONFIDENTIAL', 'TOP_SECRET'] as const

export function LiveStartPage() {
  const [contentLabel, setContentLabel] = useState('Live transfer')
  const [groupedTransfer, setGroupedTransfer] = useState(false)
  const [confidentialityLevel, setConfidentialityLevel] =
    useState<(typeof confidentialityOptions)[number]>('SECRET')

  const createMutation = useMutation({
    mutationFn: () =>
      api.createLiveTransferSession({
        contentLabel,
        contentKind: groupedTransfer ? 'GROUPED_CONTENT' : 'FILE',
        confidentialityLevel,
        groupedTransfer,
      }),
  })

  const recordsQuery = useQuery({
    queryKey: ['live', 'records'],
    queryFn: api.listLiveTransferRecords,
    retry: false,
  })

  return (
    <section className="workspace-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Live</p>
          <h2>Start live transfer</h2>
          <p className="muted">Explicit live-transfer entry with peer-to-peer first and relay fallback where allowed.</p>
        </div>
      </header>

      <section className="panel page-panel upload-form">
        <div className="upload-grid">
          <label className="field">
            <span>Content label</span>
            <input value={contentLabel} onChange={(event) => setContentLabel(event.target.value)} />
          </label>

          <label className="field">
            <span>Confidentiality</span>
            <select
              value={confidentialityLevel}
              onChange={(event) => setConfidentialityLevel(event.target.value as typeof confidentialityLevel)}
            >
              {confidentialityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="checkbox-row">
          <input type="checkbox" checked={groupedTransfer} onChange={(event) => setGroupedTransfer(event.target.checked)} />
          <span>Grouped transfer</span>
        </label>

        <div className="button-row">
          <button className="primary-button" type="button" onClick={() => createMutation.mutate()}>
            Create live session
          </button>
        </div>

        {createMutation.data ? (
          <div className="surface-card compact-card result-card">
            <p className="eyebrow">Live session created</p>
            <p className="muted">Session code: {createMutation.data.sessionCode}</p>
            <div className="button-row">
              <Link className="secondary-button button-link-secondary" to={`/live/${createMutation.data.liveTransferSessionId}`}>
                Open session
              </Link>
              <Link className="secondary-button button-link-secondary" to={`/live/${createMutation.data.liveTransferSessionId}/join`}>
                Join flow
              </Link>
            </div>
          </div>
        ) : null}

        {recordsQuery.data && recordsQuery.data.length > 0 ? (
          <div className="surface-card compact-card result-card">
            <p className="eyebrow">Retained live records</p>
            <p className="muted">Current policy retained {recordsQuery.data.length} live-transfer records for this user.</p>
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
