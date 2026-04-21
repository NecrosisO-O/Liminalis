import { Link } from 'react-router-dom'
import { useHistoryQuery } from '../hooks/useHistoryQuery.ts'

function formatTime(input: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(input))
}

export function AppHistoryPage() {
  const historyQuery = useHistoryQuery()

  return (
    <section className="workspace-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">History</p>
          <h2>Retained records</h2>
          <p className="muted">Completed and non-active records with retained status details.</p>
        </div>
      </header>

      <section className="panel page-panel history-panel">
        {historyQuery.isLoading ? (
          <p className="muted">Loading retained history.</p>
        ) : historyQuery.data && historyQuery.data.length > 0 ? (
          <div className="record-list">
            {historyQuery.data.map((item) => (
              <Link key={item.id} to={`/app/items/${item.objectId}`} className="record-card record-link-card">
                <div>
                  <strong>{item.displayTitle ?? 'Untitled record'}</strong>
                  <p className="muted">
                    {item.visibleContentTypeLabel ?? item.objectType} · {item.sourceLabel ?? 'Unknown source'}
                  </p>
                </div>
                <div className="record-side">
                  <span>{item.currentRetainedStatus ?? 'retained'}</span>
                  <span>{formatTime(item.createdTime)}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="surface-card empty-state-card compact-card">
            <p className="eyebrow">History</p>
            <h2>No retained records yet</h2>
            <p className="muted">Inactive and completed objects will appear here when available.</p>
          </div>
        )}
      </section>
    </section>
  )
}
