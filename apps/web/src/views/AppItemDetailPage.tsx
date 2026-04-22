import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api.ts'
import { useTimelineQuery } from '../hooks/useTimelineQuery.ts'
import { useHistoryQuery } from '../hooks/useHistoryQuery.ts'

function formatTime(input: string | null | undefined) {
  if (!input) {
    return 'Not available'
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(input))
}

function formatEnumLabel(input: string | null | undefined, fallback: string) {
  if (!input) {
    return fallback
  }

  return input
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function confidentialityClass(level: 'SECRET' | 'CONFIDENTIAL' | 'TOP_SECRET') {
  return `confidentiality-${level.toLowerCase()}`
}

export function AppItemDetailPage() {
  const { itemId } = useParams()
  const timelineQuery = useTimelineQuery()
  const historyQuery = useHistoryQuery()
  const isLoading = timelineQuery.isLoading || historyQuery.isLoading

  const item = useMemo(() => {
    const historyMatch = (historyQuery.data ?? []).find(
      (entry) =>
        entry.id === itemId ||
        entry.sourceObjectId === itemId ||
        entry.objectId === itemId,
    )
    if (historyMatch) {
      return {
        objectId: historyMatch.sourceObjectId ?? historyMatch.objectId ?? historyMatch.id,
        objectType: historyMatch.sourceObjectType ?? historyMatch.objectType ?? 'source_item',
        title: historyMatch.displayTitle ?? 'Untitled record',
        source: historyMatch.sourceLabel ?? 'Unknown source',
        type: historyMatch.visibleTypeLabel ?? historyMatch.sourceObjectType ?? historyMatch.objectType,
        status: historyMatch.retainedStatus ?? 'retained',
        time: historyMatch.statusTime ?? historyMatch.createdTime,
        confidentiality: historyMatch.confidentialityLevel,
        validUntil: historyMatch.sourceItem?.validUntil ?? historyMatch.shareObject?.validUntil ?? null,
        retrievable: historyMatch.retrievable,
        summary: historyMatch.visibleSummary ?? null,
        reason: historyMatch.concreteReason ?? null,
      }
    }

    const timelineMatch = (timelineQuery.data ?? []).find(
      (entry) =>
        entry.objectId === itemId ||
        entry.sourceObjectId === itemId ||
        entry.id === itemId,
    )
    if (timelineMatch) {
      return {
        objectId: timelineMatch.sourceObjectId ?? timelineMatch.objectId,
        objectType: timelineMatch.sourceObjectType ?? timelineMatch.objectType,
        title: timelineMatch.displayTitle ?? 'Untitled item',
        source: timelineMatch.sourceLabel ?? 'Unknown source',
        type: timelineMatch.visibleTypeLabel ?? timelineMatch.objectType,
        status: timelineMatch.activeStatusLabel ?? 'active',
        time: timelineMatch.createdTime,
        confidentiality: timelineMatch.confidentialityLevel,
        validUntil: timelineMatch.validUntil ?? null,
        retrievable: timelineMatch.currentRetrievable,
        summary: timelineMatch.visibleSummary ?? null,
        reason: null,
      }
    }

    return null
  }, [historyQuery.data, itemId, timelineQuery.data])

  const sourceItemQuery = useQuery({
    queryKey: ['source-item-detail', item?.objectId],
    queryFn: () => api.getSourceItem(item?.objectId ?? ''),
    enabled: item?.objectType?.toLowerCase() === 'source_item' && !!item?.objectId,
    retry: false,
  })

  const directSourceItemQuery = useQuery({
    queryKey: ['source-item-direct-detail', itemId],
    queryFn: () => api.getSourceItem(itemId ?? ''),
    enabled: !item && !isLoading && !!itemId,
    retry: false,
  })

  const fallbackItem = !item && directSourceItemQuery.data
    ? {
        objectId: directSourceItemQuery.data.id,
        objectType: 'source_item',
        title: directSourceItemQuery.data.displayName ?? 'Untitled item',
        source: 'Self space',
        type: directSourceItemQuery.data.contentKind,
        status: directSourceItemQuery.data.state,
        time: directSourceItemQuery.data.updatedAt ?? directSourceItemQuery.data.createdAt,
        confidentiality: directSourceItemQuery.data.confidentialityLevel,
        validUntil: directSourceItemQuery.data.validUntil,
        retrievable: directSourceItemQuery.data.state === 'ACTIVE',
        summary: directSourceItemQuery.data.textCiphertextBody,
        reason: null,
      }
    : null

  const resolvedItem = item ?? fallbackItem

  return (
    <section className="workspace-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Item detail</p>
          <h2>{resolvedItem?.title ?? itemId ?? 'Unknown item'}</h2>
        </div>
      </header>

      <section className="panel page-panel detail-page-shell">
        {isLoading ? (
          <div className="surface-card detail-empty-card">
            <strong>Loading record</strong>
            <p className="muted">Fetching item detail from timeline and history.</p>
          </div>
        ) : resolvedItem ? (
          <>
            <section className="detail-hero-card">
              <div className={`detail-confidentiality-bar ${confidentialityClass(resolvedItem.confidentiality)}`} aria-hidden="true" />

              <div className="detail-hero-copy">
                <p className="eyebrow">{formatEnumLabel(resolvedItem.objectType, 'Record')}</p>
                <h3>{resolvedItem.title}</h3>
                <p className="muted">{resolvedItem.summary ?? 'Visible metadata and lifecycle details for this record.'}</p>
              </div>

              <div className="detail-status-stack">
                <span className="detail-pill">{formatEnumLabel(resolvedItem.status, 'Active')}</span>
                <span className="detail-pill muted-pill">{resolvedItem.retrievable ? 'Retrievable' : 'Not retrievable'}</span>
              </div>
            </section>

            <section className="detail-meta-grid">
              <div className="surface-card detail-meta-card">
                <span className="eyebrow">Type</span>
                <strong>{formatEnumLabel(resolvedItem.type, 'Unknown type')}</strong>
              </div>
              <div className="surface-card detail-meta-card">
                <span className="eyebrow">Source</span>
                <strong>{resolvedItem.source}</strong>
              </div>
              <div className="surface-card detail-meta-card">
                <span className="eyebrow">Status time</span>
                <strong>{formatTime(resolvedItem.time)}</strong>
              </div>
              <div className="surface-card detail-meta-card">
                <span className="eyebrow">Expiry</span>
                <strong>{formatTime(resolvedItem.validUntil)}</strong>
              </div>
              <div className="surface-card detail-meta-card">
                <span className="eyebrow">Confidentiality</span>
                <strong>{formatEnumLabel(resolvedItem.confidentiality, resolvedItem.confidentiality)}</strong>
              </div>
              <div className="surface-card detail-meta-card">
                <span className="eyebrow">Reason</span>
                <strong>{formatEnumLabel(resolvedItem.reason, 'None')}</strong>
              </div>
            </section>

            <section className="detail-body-grid">
              <div className="surface-card detail-section-card">
                <p className="eyebrow">Content</p>
                {sourceItemQuery.data?.textCiphertextBody || directSourceItemQuery.data?.textCiphertextBody ? (
                  <div className="detail-text-body">{sourceItemQuery.data?.textCiphertextBody ?? directSourceItemQuery.data?.textCiphertextBody}</div>
                ) : (
                  <div className="detail-fallback-copy">
                    <strong>No inline content preview</strong>
                    <p className="muted">This record does not expose full body content in the current detail surface.</p>
                  </div>
                )}
              </div>

              <div className="surface-card detail-section-card">
                <p className="eyebrow">Actions</p>
                <div className="detail-action-list">
                  <Link className="secondary-button button-link-secondary" to="/app/share-tools">
                    Open share tools
                  </Link>
                  <Link
                    className="secondary-button button-link-secondary"
                    to={itemId ? `/app/share-tools?sourceItemId=${encodeURIComponent(itemId)}` : '/app/share-tools'}
                  >
                    Share this item
                  </Link>
                  <Link className="secondary-button button-link-secondary" to="/app/history">
                    Back to history
                  </Link>
                </div>
              </div>
            </section>
          </>
        ) : (
          <div className="surface-card detail-empty-card">
            <strong>Record not loaded</strong>
            <p className="muted">This item is not currently present in the loaded timeline or history results.</p>
          </div>
        )}
      </section>
    </section>
  )
}
