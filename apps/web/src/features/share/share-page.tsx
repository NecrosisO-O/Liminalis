import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import { api } from '../../shared/api/client.ts'
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
    mutationFn: () => api.createShare({ sourceItemId, recipientUsername: recipient, requestedValidityMinutes: 60 }),
    onSuccess: (data) => setResult(`User share created for recipient: ${data.shareObjectId}`),
  })

  const createExtraction = useMutation({
    mutationFn: () => api.createExtraction({ sourceItemId, password: password.trim() || undefined, requestedValidityMinutes: 60, requestedRetrievalCount: 1 }),
    onSuccess: (data) => setResult(`Password extraction ready: /x/${data.entryToken} · password ${data.password}`),
  })

  const createPublicLink = useMutation({
    mutationFn: () => api.createPublicLink({ sourceItemId, requestedValidityMinutes: 60, requestedDownloadCount: 1 }),
    onSuccess: (data) => setResult(`Public link ready: /p/${data.linkToken}`),
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
      <section className="share-grid">
        <article className="action-panel">
          <h3>User share</h3>
          <Field label="Recipient username">
            <TextInput value={recipient} onChange={(event) => setRecipient(event.target.value)} />
          </Field>
          <Button variant="primary" onClick={() => createUserShare.mutate()} disabled={!recipient.trim() || createUserShare.isPending}>Create user share</Button>
          {createUserShare.error instanceof Error ? <p className="field-error">{createUserShare.error.message}</p> : null}
        </article>
        <article className="action-panel">
          <h3>Password extraction</h3>
          <Field label="Password" hint="Leave empty to let policy generate one">
            <TextInput value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          <Button onClick={() => createExtraction.mutate()} disabled={createExtraction.isPending}>Create extraction</Button>
          {createExtraction.error instanceof Error ? <p className="field-error">{createExtraction.error.message}</p> : null}
        </article>
        <article className="action-panel">
          <h3>Public link</h3>
          <p className="muted">Recipients opening the link immediately download the file.</p>
          <Button onClick={() => createPublicLink.mutate()} disabled={createPublicLink.isPending}>Create public link</Button>
          {createPublicLink.error instanceof Error ? <p className="field-error">{createPublicLink.error.message}</p> : null}
        </article>
      </section>
      {result ? <Toast tone="success">{result}</Toast> : null}
    </section>
  )
}
