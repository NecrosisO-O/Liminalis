import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { api, type ConfidentialityLevel, type HistoryEntry, type SourceItemDetail } from '../../shared/api/client.ts'
import { Button, Dialog, EmptyState, Field, SelectInput, TextInput, Toast } from '../../shared/ui/components.tsx'
import { confidentialityClass, formatDateTime, humanEnum } from '../../shared/ui/format.ts'
import { downloadShareObject, downloadSourceItem, formatBytes, itemObjectIds } from '../../shared/files/transfer.ts'

function titleFor(entry: HistoryEntry) {
  return entry.displayTitle ?? humanEnum(entry.visibleTypeLabel, 'Untitled item')
}

export function HistoryPage() {
  const history = useQuery({
    queryKey: ['history'],
    queryFn: api.getHistory,
  })

  return (
    <section className="workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">History</p>
          <h2>Active items and retained records</h2>
        </div>
      </header>
      <section className="table-panel">
        {history.isLoading ? <EmptyState title="Loading history" /> : null}
        {history.data?.length === 0 ? <EmptyState title="No history yet" detail="Active and retained records appear here." /> : null}
        {history.data && history.data.length > 0 ? (
          <div className="data-table history-table">
            <div className="table-head">
              <span>Record</span>
              <span>Type</span>
              <span>Source</span>
              <span>Status</span>
              <span>Expiry</span>
              <span>Time</span>
            </div>
            {history.data.map((entry) => (
              <Link key={entry.id} className="table-row" to={`/app/items/${entry.sourceObjectId}`}>
                <span className="record-cell">
                  <i className={confidentialityClass(entry.confidentialityLevel)} />
                  <strong>{titleFor(entry)}</strong>
                </span>
                <span>{entry.visibleTypeLabel}</span>
                <span>{entry.sourceLabel}</span>
                <span>{entry.retainedStatus}</span>
                <span>{formatDateTime(entry.sourceItem?.validUntil ?? entry.shareObject?.validUntil)}</span>
                <span>{formatDateTime(entry.statusTime ?? entry.createdTime)}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </section>
  )
}

export function ItemDetailPage() {
  const { itemId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [toast, setToast] = useState<{ tone: 'success' | 'danger' | 'warning'; message: string } | null>(null)
  const [validity, setValidity] = useState('60')
  const [level, setLevel] = useState<ConfidentialityLevel>('SECRET')
  const [shareOpen, setShareOpen] = useState(false)

  const history = useQuery({
    queryKey: ['history'],
    queryFn: api.getHistory,
  })

  const projection = useMemo(
    () => history.data?.find((entry) => entry.sourceObjectId === itemId || entry.sourceItemId === itemId || entry.shareObjectId === itemId),
    [history.data, itemId],
  )
  const ids = projection ? itemObjectIds(projection) : { sourceItemId: itemId, shareObjectId: null }

  const sourceItem = useQuery({
    queryKey: ['source-item', ids.sourceItemId],
    queryFn: () => api.getSourceItem(ids.sourceItemId ?? ''),
    enabled: Boolean(ids.sourceItemId),
    retry: false,
  })

  const download = useMutation({
    mutationFn: async () => {
      if (ids.shareObjectId) {
        return downloadShareObject(ids.shareObjectId, projection?.displayTitle ?? 'shared-download.bin')
      }

      if (ids.sourceItemId) {
        return downloadSourceItem(ids.sourceItemId, sourceItem.data?.displayName ?? projection?.displayTitle ?? 'download.bin')
      }

      throw new Error('This item is not downloadable.')
    },
    onSuccess: () => setToast({ tone: 'success', message: 'Download started.' }),
    onError: (error) => setToast({ tone: 'danger', message: error instanceof Error ? error.message : 'Download failed.' }),
  })

  const revoke = useMutation({
    mutationFn: () => api.revokeSourceItem(ids.sourceItemId ?? ''),
    onSuccess: async () => {
      setToast({ tone: 'success', message: 'Item availability removed.' })
      await queryClient.invalidateQueries({ queryKey: ['history'] })
      await queryClient.invalidateQueries({ queryKey: ['timeline'] })
      await queryClient.invalidateQueries({ queryKey: ['source-item', ids.sourceItemId] })
    },
  })

  const updateValidity = useMutation({
    mutationFn: () => api.updateValidity(ids.sourceItemId ?? '', Number(validity)),
    onSuccess: async () => {
      setToast({ tone: 'success', message: 'Validity updated.' })
      await queryClient.invalidateQueries({ queryKey: ['history'] })
      await queryClient.invalidateQueries({ queryKey: ['timeline'] })
      await queryClient.invalidateQueries({ queryKey: ['source-item', ids.sourceItemId] })
    },
  })

  const changeLevel = useMutation({
    mutationFn: () => api.changeConfidentiality(ids.sourceItemId ?? '', level),
    onSuccess: async () => {
      setToast({ tone: 'warning', message: 'Confidentiality updated. Incompatible outward access may have been revoked.' })
      await queryClient.invalidateQueries({ queryKey: ['history'] })
      await queryClient.invalidateQueries({ queryKey: ['timeline'] })
      await queryClient.invalidateQueries({ queryKey: ['source-item', ids.sourceItemId] })
    },
  })

  const detail = sourceItem.data

  if (history.isLoading || sourceItem.isLoading) {
    return <section className="workspace-page"><EmptyState title="Loading item" /></section>
  }

  if (!projection && sourceItem.isError) {
    return (
      <section className="workspace-page">
        <EmptyState title="Item not found" detail="This record is not visible in your history." actions={<Button onClick={() => navigate('/app/history')}>Back to history</Button>} />
      </section>
    )
  }

  return (
    <section className="workspace-page detail-page">
      {toast ? <Toast tone={toast.tone}>{toast.message}</Toast> : null}
      <header className="detail-hero">
        <div>
          <p className="eyebrow">Item detail</p>
          <h2>{detail?.displayName ?? projection?.displayTitle ?? itemId}</h2>
          <p className="muted">{projection?.sourceLabel ?? 'Self space'} · {detail?.contentKind ?? projection?.visibleTypeLabel ?? 'item'}</p>
        </div>
        <div className="actions">
          <Button variant="primary" onClick={() => download.mutate()} disabled={download.isPending}>
            Download
          </Button>
          {ids.sourceItemId && detail?.contentKind !== 'SELF_SPACE_TEXT' ? <Button onClick={() => setShareOpen(true)}>Share</Button> : null}
        </div>
      </header>
      <section className="detail-grid">
        <MetaCard label="State" value={detail?.state ?? projection?.retainedStatus ?? 'Unknown'} />
        <MetaCard label="Confidentiality" value={detail?.confidentialityLevel ?? projection?.confidentialityLevel ?? 'Unknown'} />
        <MetaCard label="Size" value={detail ? formatBytes(detail.storageBytes) : 'Unknown'} />
        <MetaCard label="Expiry" value={formatDateTime(detail?.validUntil ?? projection?.sourceItem?.validUntil)} />
        <MetaCard label="Burn after read" value={detail?.burnAfterReadEnabled ? 'Enabled' : 'Disabled'} />
        <MetaCard label="Created" value={formatDateTime(detail?.createdAt ?? projection?.createdTime)} />
      </section>
      {detail?.textCiphertextBody ? (
        <section className="content-panel">
          <h3>Text</h3>
          <p>{detail.textCiphertextBody}</p>
        </section>
      ) : null}
      {detail ? (
        <section className="management-panel">
          <h3>Manage availability</h3>
          <div className="management-grid">
            <Field label="Validity minutes">
              <TextInput value={validity} onChange={(event) => setValidity(event.target.value)} inputMode="numeric" />
            </Field>
            <Button onClick={() => updateValidity.mutate()} disabled={updateValidity.isPending}>Update validity</Button>
            <Field label="Confidentiality">
              <SelectInput value={level} onChange={(event) => setLevel(event.target.value as ConfidentialityLevel)}>
                <option value="SECRET">SECRET</option>
                <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                <option value="TOP_SECRET">TOP_SECRET</option>
              </SelectInput>
            </Field>
            <Button onClick={() => changeLevel.mutate()} disabled={changeLevel.isPending}>Change level</Button>
            <Button variant="danger" onClick={() => revoke.mutate()} disabled={revoke.isPending || detail.state !== 'ACTIVE'}>
              Remove availability
            </Button>
          </div>
        </section>
      ) : null}
      {shareOpen && ids.sourceItemId ? <ShareDialog sourceItem={detail} sourceItemId={ids.sourceItemId} onClose={() => setShareOpen(false)} /> : null}
    </section>
  )
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function ShareDialog({ sourceItem, sourceItemId, onClose }: { sourceItem?: SourceItemDetail; sourceItemId: string; onClose: () => void }) {
  const [recipient, setRecipient] = useState('')
  const [password, setPassword] = useState('')
  const [result, setResult] = useState<string | null>(null)

  const share = useMutation({
    mutationFn: () => api.createShare({ sourceItemId, recipientUsername: recipient, requestedValidityMinutes: 60 }),
    onSuccess: (data) => setResult(`User share created: ${data.shareObjectId}`),
  })
  const extraction = useMutation({
    mutationFn: () => api.createExtraction({ sourceItemId, password: password.trim() || undefined, requestedValidityMinutes: 60, requestedRetrievalCount: 1 }),
    onSuccess: (data) => setResult(`Extraction: /x/${data.entryToken} · password ${data.password}`),
  })
  const publicLink = useMutation({
    mutationFn: () => api.createPublicLink({ sourceItemId, requestedValidityMinutes: 60, requestedDownloadCount: 1 }),
    onSuccess: (data) => setResult(`Public link: /p/${data.linkToken}`),
  })

  return (
    <Dialog title="Share item" onClose={onClose}>
      <div className="form-stack">
        <p className="muted">{sourceItem?.displayName ?? 'Selected item'}</p>
        <Field label="Recipient username">
          <TextInput value={recipient} onChange={(event) => setRecipient(event.target.value)} />
        </Field>
        <Button variant="primary" onClick={() => share.mutate()} disabled={!recipient.trim() || share.isPending}>Create user share</Button>
        <Field label="Extraction password" hint="Optional unless policy generates one">
          <TextInput value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>
        <div className="actions">
          <Button onClick={() => extraction.mutate()} disabled={extraction.isPending}>Create password extraction</Button>
          <Button onClick={() => publicLink.mutate()} disabled={publicLink.isPending}>Create public link</Button>
        </div>
        {[share.error, extraction.error, publicLink.error].map((error, index) => error instanceof Error ? <p key={index} className="field-error">{error.message}</p> : null)}
        {result ? <Toast tone="success">{result}</Toast> : null}
      </div>
    </Dialog>
  )
}
