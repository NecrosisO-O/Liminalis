import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type PrepareUploadInput } from '../lib/api.ts'

const confidentialityOptions = ['SECRET', 'CONFIDENTIAL', 'TOP_SECRET'] as const
const contentKindOptions = ['SELF_SPACE_TEXT', 'FILE', 'GROUPED_CONTENT'] as const

export function AppUploadPage() {
  const queryClient = useQueryClient()
  const [contentKind, setContentKind] = useState<(typeof contentKindOptions)[number]>('SELF_SPACE_TEXT')
  const [confidentialityLevel, setConfidentialityLevel] =
    useState<(typeof confidentialityOptions)[number]>('SECRET')
  const [displayName, setDisplayName] = useState('')
  const [textCiphertextBody, setTextCiphertextBody] = useState('')
  const [requestedValidityMinutes, setRequestedValidityMinutes] = useState('60')
  const [burnAfterReadEnabled, setBurnAfterReadEnabled] = useState(false)

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const prepareInput: PrepareUploadInput = {
        contentKind,
        confidentialityLevel,
        requestedValidityMinutes: requestedValidityMinutes.trim() === '' ? undefined : Number(requestedValidityMinutes),
        burnAfterReadEnabled,
      }

      if (contentKind === 'GROUPED_CONTENT') {
        prepareInput.groupStructureKind = 'MULTI_FILE'
      }

      const prepared = await api.prepareUpload(prepareInput)

      if (contentKind === 'SELF_SPACE_TEXT') {
        return api.finalizeUpload(prepared.uploadSessionId, {
          displayName: displayName.trim() || 'Untitled text',
          textCiphertextBody,
        })
      }

      return api.finalizeUpload(prepared.uploadSessionId, {
        displayName: displayName.trim() || (contentKind === 'GROUPED_CONTENT' ? 'Grouped upload' : 'Uploaded file'),
        manifest:
          contentKind === 'GROUPED_CONTENT'
            ? {
                items: [
                  { path: 'alpha.txt', byteSize: 512, contentType: 'text/plain' },
                  { path: 'beta.txt', byteSize: 512, contentType: 'text/plain' },
                ],
              }
            : undefined,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['timeline'] })
      await queryClient.invalidateQueries({ queryKey: ['history'] })
      setDisplayName('')
      setTextCiphertextBody('')
    },
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    uploadMutation.mutate()
  }

  return (
    <section className="workspace-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Upload</p>
          <h2>Advanced upload</h2>
          <p className="muted">Use this surface for grouped content and more deliberate stored-transfer creation.</p>
        </div>
      </header>

      <form className="panel page-panel upload-form" onSubmit={handleSubmit}>
        <div className="upload-grid">
          <label className="field">
            <span>Content kind</span>
            <select value={contentKind} onChange={(event) => setContentKind(event.target.value as typeof contentKind)}>
              {contentKindOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
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

          <label className="field">
            <span>Display name</span>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>

          <label className="field">
            <span>Requested validity minutes</span>
            <input value={requestedValidityMinutes} onChange={(event) => setRequestedValidityMinutes(event.target.value)} />
          </label>
        </div>

        {contentKind === 'SELF_SPACE_TEXT' ? (
          <label className="field">
            <span>Text body</span>
            <textarea value={textCiphertextBody} onChange={(event) => setTextCiphertextBody(event.target.value)} rows={8} />
          </label>
        ) : (
          <div className="surface-card compact-card upload-note-card">
            <p className="eyebrow">Upload note</p>
            <p className="muted">
              This frontend pass uses the current backend prepare/finalize flow and a lightweight metadata-only submission path for non-text uploads.
            </p>
          </div>
        )}

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={burnAfterReadEnabled}
            onChange={(event) => setBurnAfterReadEnabled(event.target.checked)}
          />
          <span>Enable burn-after-read</span>
        </label>

        <div className="button-row">
          <button className="primary-button" type="submit" disabled={uploadMutation.isPending}>
            {uploadMutation.isPending ? 'Creating...' : 'Create stored item'}
          </button>
        </div>
      </form>
    </section>
  )
}
