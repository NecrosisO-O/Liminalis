import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import { api } from '../../shared/api/client.ts'
import { createE2eeExtraction, createE2eePublicLink, createE2eeUserShare } from '../../shared/files/sharing.ts'
import { Button, Field, StatusView, TextInput, Toast } from '../../shared/ui/components.tsx'

export function SharePage() {
  const { sourceItemId = '' } = useParams()
  const [recipient, setRecipient] = useState('')
  const [password, setPassword] = useState('')
  const [result, setResult] = useState<string | null>(null)

  const item = useQuery({
    queryKey: ['source-item', sourceItemId],
    queryFn: () => api.getSourceItem(sourceItemId),
    enabled: sourceItemId !== '',
    retry: false,
  })

  const createUserShare = useMutation({
    mutationFn: () => createE2eeUserShare({ sourceItemId, recipientUsername: recipient, requestedValidityMinutes: 60 }),
    onSuccess: (data) => setResult(`User share created for recipient: ${data.shareObjectId}`),
  })

  const createExtraction = useMutation({
    mutationFn: () => createE2eeExtraction({ sourceItemId, password: password.trim() || undefined, requestedValidityMinutes: 60, requestedRetrievalCount: 1 }),
    onSuccess: (data) => setResult(`Password extraction ready: ${data.publicUrl} · password ${data.password}`),
  })

  const createPublicLink = useMutation({
    mutationFn: () => createE2eePublicLink({ sourceItemId, requestedValidityMinutes: 60, requestedDownloadCount: 1 }),
    onSuccess: (data) => setResult(`Public link ready: ${data.publicUrl}`),
  })

  if (item.isLoading) {
    return <section className="workspace-page"><StatusView title="Loading item" detail="Preparing sharing options." /></section>
  }

  if (item.isError || !item.data) {
    return <section className="workspace-page"><StatusView title="Item unavailable" detail="This item cannot be shared." tone="danger" /></section>
  }

  if (item.data.contentKind === 'SELF_SPACE_TEXT') {
    return (
      <section className="workspace-page">
        <StatusView
          title="Text items stay in self space"
          detail="v1 does not allow outward sharing for self-space text items."
          actions={<Link className="button button-secondary" to={`/app/items/${sourceItemId}`}>Back to item</Link>}
        />
      </section>
    )
  }

  return (
    <section className="workspace-page share-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Share</p>
          <h2>{item.data.displayName ?? 'Selected item'}</h2>
        </div>
        <Link className="button button-secondary" to={`/app/items/${sourceItemId}`}>Back to detail</Link>
      </header>
      <section className="share-methods">
        <article className="share-method">
          <div className="share-method-heading">
            <span className="share-method-kicker">Trusted user</span>
            <h3>User share</h3>
          </div>
          <div className="share-method-body">
            <Field label="Recipient username">
              <TextInput value={recipient} onChange={(event) => setRecipient(event.target.value)} />
            </Field>
            {createUserShare.error instanceof Error ? <p className="field-error">{createUserShare.error.message}</p> : null}
          </div>
          <Button variant="primary" onClick={() => createUserShare.mutate()} disabled={!recipient.trim() || createUserShare.isPending}>Create user share</Button>
        </article>
        <article className="share-method">
          <div className="share-method-heading">
            <span className="share-method-kicker">One-time access</span>
            <h3>Password extraction</h3>
          </div>
          <div className="share-method-body">
            <Field label="Password" hint="Leave empty to let policy generate one">
              <TextInput value={password} onChange={(event) => setPassword(event.target.value)} />
            </Field>
            {createExtraction.error instanceof Error ? <p className="field-error">{createExtraction.error.message}</p> : null}
          </div>
          <Button onClick={() => createExtraction.mutate()} disabled={createExtraction.isPending}>Create extraction</Button>
        </article>
        <article className="share-method">
          <div className="share-method-heading">
            <span className="share-method-kicker">Direct link</span>
            <h3>Public link</h3>
          </div>
          <div className="share-method-body">
            <p className="muted">Recipients opening the link immediately download the file.</p>
            {createPublicLink.error instanceof Error ? <p className="field-error">{createPublicLink.error.message}</p> : null}
          </div>
          <Button onClick={() => createPublicLink.mutate()} disabled={createPublicLink.isPending}>Create public link</Button>
        </article>
      </section>
      {result ? <Toast tone="success">{result}</Toast> : null}
    </section>
  )
}
