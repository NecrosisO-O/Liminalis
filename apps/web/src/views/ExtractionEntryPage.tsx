import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../lib/api.ts'

function createAttemptScopeKey() {
  return `extraction-${crypto.randomUUID()}`
}

export function ExtractionEntryPage() {
  const { entryToken } = useParams()
  const [password, setPassword] = useState('')
  const attemptScopeKey = useMemo(() => createAttemptScopeKey(), [])

  const entryQuery = useQuery({
    queryKey: ['extraction', 'entry', entryToken],
    queryFn: () => api.getExtractionEntry(entryToken ?? ''),
    enabled: Boolean(entryToken),
    retry: false,
  })

  const submitMutation = useMutation({
    mutationFn: (captchaSatisfied?: boolean) =>
      api.submitExtractionPassword(entryToken ?? '', attemptScopeKey, password, captchaSatisfied),
  })

  return (
    <section className="surface-card auth-card">
      <p className="eyebrow">Extraction</p>
      <h2>Password extraction</h2>
      <p className="muted">Enter the extraction password first. Metadata appears only after successful unlock.</p>

      {entryQuery.data?.metadata ? (
        <div className="detail-list">
          <div>
            <span>Title</span>
            <strong>{entryQuery.data.metadata.displayTitle}</strong>
          </div>
          <div>
            <span>Sender</span>
            <strong>{entryQuery.data.metadata.senderUsername}</strong>
          </div>
        </div>
      ) : null}

      <label className="field">
        <span>Password</span>
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>

      <div className="button-row">
        <button className="primary-button" type="button" onClick={() => submitMutation.mutate(false)}>
          Unlock
        </button>
        {entryQuery.data?.requiresCaptcha ? (
          <button className="secondary-button" type="button" onClick={() => submitMutation.mutate(true)}>
            Unlock with captcha
          </button>
        ) : null}
      </div>

      {submitMutation.data ? (
        <div className="surface-card compact-card result-card">
          <p className="eyebrow">Unlocked</p>
          <p className="muted">Retrieval attempt created for {submitMutation.data.contentKind.toLowerCase()}.</p>
        </div>
      ) : null}
    </section>
  )
}
