import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTimelineQuery } from '../hooks/useTimelineQuery.ts'
import { useHistoryQuery } from '../hooks/useHistoryQuery.ts'

export function AppItemDetailPage() {
  const { itemId } = useParams()
  const timelineQuery = useTimelineQuery()
  const historyQuery = useHistoryQuery()

  const item = useMemo(() => {
    const timelineMatch = (timelineQuery.data ?? []).find((entry) => entry.objectId === itemId || entry.id === itemId)
    if (timelineMatch) {
      return {
        title: timelineMatch.displayTitle ?? 'Untitled item',
        source: timelineMatch.sourceLabel ?? 'Unknown source',
        type: timelineMatch.visibleTypeLabel ?? timelineMatch.objectType,
        status: timelineMatch.activeStatusLabel ?? 'active',
        time: timelineMatch.createdTime,
        confidentiality: timelineMatch.confidentialityLevel,
      }
    }

    const historyMatch = (historyQuery.data ?? []).find((entry) => entry.objectId === itemId || entry.id === itemId)
    if (historyMatch) {
      return {
        title: historyMatch.displayTitle ?? 'Untitled record',
        source: historyMatch.sourceLabel ?? 'Unknown source',
        type: historyMatch.visibleContentTypeLabel ?? historyMatch.objectType,
        status: historyMatch.currentRetainedStatus ?? 'retained',
        time: historyMatch.createdTime,
        confidentiality: historyMatch.confidentialityLevel,
      }
    }

    return null
  }, [historyQuery.data, itemId, timelineQuery.data])

  return (
    <section className="workspace-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Item detail</p>
          <h2>{item?.title ?? itemId ?? 'Unknown item'}</h2>
          <p className="muted">Focused object detail and action surface.</p>
        </div>
      </header>

      <section className="panel page-panel admin-section-grid">
        {item ? (
          <div className="detail-list">
            <div>
              <span>Type</span>
              <strong>{item.type}</strong>
            </div>
            <div>
              <span>Source</span>
              <strong>{item.source}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{item.status}</strong>
            </div>
            <div>
              <span>Confidentiality</span>
              <strong>{item.confidentiality}</strong>
            </div>
            <div>
              <span>Time</span>
              <strong>{new Date(item.time).toLocaleString()}</strong>
            </div>
          </div>
        ) : (
          <p className="muted">This item is not currently present in loaded timeline or history data.</p>
        )}

        <div className="button-row">
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
      </section>
    </section>
  )
}
