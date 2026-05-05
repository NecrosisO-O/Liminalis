import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, ApiError, type ExtractionUnlockResult } from '../../shared/api/client.ts'
import {
  decryptFilePayloadWithKey,
  decryptSourceMetadataWithKey,
  sourceKeyFromPasswordEnvelope,
  type SourceKeyEnvelope,
} from '../../shared/crypto/envelope.ts'
import { Button, Field, StatusView, TextInput, Toast } from '../../shared/ui/components.tsx'
import { makeAttemptScope, saveBlobAsDownload } from '../../shared/files/transfer.ts'

export function ExtractionPage() {
  const { entryToken = '' } = useParams()
  const [password, setPassword] = useState('')
  const [captchaSatisfied, setCaptchaSatisfied] = useState(false)
  const [unlocked, setUnlocked] = useState<ExtractionUnlockResult | null>(null)
  const attemptScope = useMemo(() => makeAttemptScope('extraction'), [])

  const entry = useQuery({
    queryKey: ['extraction', entryToken],
    queryFn: () => api.getExtractionEntry(entryToken),
    retry: false,
  })

  const unlock = useMutation({
    mutationFn: () => api.submitExtractionPassword(entryToken, attemptScope, password, captchaSatisfied),
    onSuccess: setUnlocked,
  })

  const download = useMutation({
    mutationFn: async () => {
      if (!unlocked) {
        throw new Error('Unlock the extraction first.')
      }

      try {
        const response = await api.downloadExtractionRetrieval(unlocked.retrievalAttemptId)
        const sourceKey = await sourceKeyFromPasswordEnvelope(unlocked.wrappedPayloadReference as SourceKeyEnvelope, password)
        const metadata = unlocked.encryptedMetadata
          ? await decryptSourceMetadataWithKey(unlocked.encryptedMetadata, sourceKey).catch(() => null)
          : null
        const decrypted = await decryptFilePayloadWithKey(await response.blob(), unlocked.contentCryptoMetadata, sourceKey)
        saveBlobAsDownload(decrypted, metadata?.displayName ?? (unlocked.metadata.displayTitle || 'liminalis-download.bin'))
        await api.completeExtractionRetrieval(unlocked.retrievalAttemptId, true)
      } catch (error) {
        await api.completeExtractionRetrieval(unlocked.retrievalAttemptId, false).catch(() => undefined)
        throw error
      }
    },
  })

  const needsCaptcha =
    entry.data?.requiresCaptcha ||
    (unlock.error instanceof ApiError && (unlock.error.status === 400 || unlock.error.status === 403))

  if (entry.isLoading) {
    return <main className="entry-screen"><StatusView title="Opening extraction" detail="Checking the access entry." /></main>
  }

  if (entry.isError) {
    return <main className="entry-screen"><StatusView title="Extraction unavailable" detail="This access entry cannot be used." tone="danger" /></main>
  }

  return (
    <main className="entry-screen">
      <section className="entry-panel">
        <p className="eyebrow">Password extraction</p>
        <h1>{unlocked ? unlocked.metadata.displayTitle : 'Enter password'}</h1>
        <p className="muted">
          {unlocked ? `${unlocked.metadata.senderUsername} · ${unlocked.metadata.confidentialityLevel}` : 'Metadata appears only after a successful unlock.'}
        </p>
        {!unlocked ? (
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault()
              unlock.mutate()
            }}
          >
            <Field label="Password" error={unlock.error instanceof Error ? unlock.error.message : null}>
              <TextInput value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="off" required />
            </Field>
            {needsCaptcha ? (
              <label className="check-row">
                <input type="checkbox" checked={captchaSatisfied} onChange={(event) => setCaptchaSatisfied(event.target.checked)} />
                <span>Captcha satisfied</span>
              </label>
            ) : null}
            <Button variant="primary" type="submit" disabled={unlock.isPending || (needsCaptcha && !captchaSatisfied)}>
              Unlock
            </Button>
          </form>
        ) : (
          <div className="form-stack">
            <div className="detail-list">
              <div>
                <span>Content</span>
                <strong>{unlocked.metadata.contentKind}</strong>
              </div>
              <div>
                <span>Remaining</span>
                <strong>{unlocked.remainingRetrievalCount}</strong>
              </div>
            </div>
            <Button variant="primary" onClick={() => download.mutate()} disabled={download.isPending}>Download</Button>
            {download.error instanceof Error ? <p className="field-error">{download.error.message}</p> : null}
            {download.isSuccess ? <Toast tone="success">Download started.</Toast> : null}
          </div>
        )}
      </section>
    </main>
  )
}
