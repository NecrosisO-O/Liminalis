import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { api } from '../lib/api.ts'

export function ShareToolsPage() {
  const [searchParams] = useSearchParams()
  const [sourceItemId, setSourceItemId] = useState(() => searchParams.get('sourceItemId') ?? '')
  const [recipientUsername, setRecipientUsername] = useState('')
  const [validity, setValidity] = useState('60')
  const [shareObjectId, setShareObjectId] = useState('')
  const [extractionPassword, setExtractionPassword] = useState('')

  const shareMutation = useMutation({
    mutationFn: () =>
      api.createShare({
        sourceItemId,
        recipientUsername,
        requestedValidityMinutes: validity.trim() === '' ? undefined : Number(validity),
      }),
    onSuccess: (result) => {
      setShareObjectId(result.shareObjectId)
    },
  })

  const extractionMutation = useMutation({
    mutationFn: () =>
      api.createExtraction({
        shareObjectId,
        password: extractionPassword.trim() === '' ? undefined : extractionPassword,
        requestedValidityMinutes: 60,
        requestedRetrievalCount: 1,
      }),
  })

  const publicLinkMutation = useMutation({
    mutationFn: () =>
      api.createPublicLink({
        shareObjectId,
        requestedValidityMinutes: 60,
        requestedDownloadCount: 1,
      }),
  })

  return (
    <section className="workspace-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Share tools</p>
          <h2>Item-first sharing</h2>
          <p className="muted">Create shares from existing source items, then derive extraction or public links from the share object.</p>
        </div>
      </header>

      <section className="panel page-panel upload-form">
        <div className="upload-grid">
          <label className="field">
            <span>Source item ID</span>
            <input value={sourceItemId} onChange={(event) => setSourceItemId(event.target.value)} />
          </label>

          <label className="field">
            <span>Recipient username</span>
            <input value={recipientUsername} onChange={(event) => setRecipientUsername(event.target.value)} />
          </label>

          <label className="field">
            <span>Requested share validity</span>
            <input value={validity} onChange={(event) => setValidity(event.target.value)} />
          </label>
        </div>

        <div className="button-row">
          <button className="primary-button" type="button" onClick={() => shareMutation.mutate()}>
            Create user share
          </button>
        </div>

        {shareMutation.data ? (
          <div className="surface-card compact-card result-card">
            <p className="eyebrow">Share created</p>
            <p className="muted">Share object: {shareMutation.data.shareObjectId}</p>
          </div>
        ) : null}

        <div className="upload-grid">
          <label className="field">
            <span>Share object ID</span>
            <input value={shareObjectId} onChange={(event) => setShareObjectId(event.target.value)} />
          </label>

          <label className="field">
            <span>Custom extraction password (optional)</span>
            <input value={extractionPassword} onChange={(event) => setExtractionPassword(event.target.value)} />
          </label>
        </div>

        <div className="button-row">
          <button className="secondary-button" type="button" onClick={() => extractionMutation.mutate()}>
            Create extraction
          </button>
          <button className="secondary-button" type="button" onClick={() => publicLinkMutation.mutate()}>
            Create public link
          </button>
        </div>

        {extractionMutation.data ? (
          <div className="surface-card compact-card result-card">
            <p className="eyebrow">Extraction created</p>
            <p className="muted">Entry token: {extractionMutation.data.entryToken}</p>
            <p className="muted">Password: {extractionMutation.data.password}</p>
          </div>
        ) : null}

        {publicLinkMutation.data ? (
          <div className="surface-card compact-card result-card">
            <p className="eyebrow">Public link created</p>
            <p className="muted">Link token: {publicLinkMutation.data.linkToken}</p>
          </div>
        ) : null}
      </section>
    </section>
  )
}
