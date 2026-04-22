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

function confidentialityClass(level: 'SECRET' | 'CONFIDENTIAL' | 'TOP_SECRET') {
  return `confidentiality-${level.toLowerCase()}`
}

function formatExpiryTime(input: string | null | undefined) {
  return input ? formatTime(input) : 'No expiry'
}

function formatValidityWindow(createdTime: string, validUntil: string | null | undefined) {
  if (!validUntil) {
    return 'Open-ended'
  }

  const createdMs = new Date(createdTime).getTime()
  const expiryMs = new Date(validUntil).getTime()
  const diffMinutes = Math.max(0, Math.round((expiryMs - createdMs) / 60000))

  if (diffMinutes >= 1440 && diffMinutes % 1440 === 0) {
    return `${diffMinutes / 1440}d`
  }

  if (diffMinutes >= 60 && diffMinutes % 60 === 0) {
    return `${diffMinutes / 60}h`
  }

  return `${diffMinutes}m`
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

export function AppHistoryPage() {
  const historyQuery = useHistoryQuery()

  return (
    <section className="workspace-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">History</p>
          <h2>Retained records</h2>
        </div>
      </header>

      <section className="panel page-panel history-panel">
        {historyQuery.isLoading ? (
          <p className="muted">Loading retained history.</p>
        ) : historyQuery.data && historyQuery.data.length > 0 ? (
          <div className="history-table">
            <div className="history-row history-header-row">
              <span>Record</span>
              <span>Type</span>
              <span>Source</span>
              <span>Validity</span>
              <span>Expiry</span>
              <span>Status</span>
              <span>Reason</span>
              <span>Retrievable</span>
              <span>Time</span>
            </div>

            {historyQuery.data.map((item) => {
              const validUntil = item.sourceItem?.validUntil ?? item.shareObject?.validUntil ?? null

              return (
                <Link key={item.id} to={`/app/items/${item.id}`} className="history-row history-data-row">
                  <div className="history-cell history-record-cell">
                    <div className={`history-confidentiality-bar ${confidentialityClass(item.confidentialityLevel)}`} aria-hidden="true" />
                    <strong className="history-value">{item.displayTitle ?? 'Untitled record'}</strong>
                  </div>

                  <div className="history-cell">
                    <span className="history-value">
                      {formatEnumLabel(item.visibleTypeLabel ?? item.sourceObjectType ?? item.objectType, 'Unknown type')}
                    </span>
                  </div>

                  <div className="history-cell">
                    <span className="history-value">{item.sourceLabel ?? 'Unknown source'}</span>
                  </div>

                  <div className="history-cell">
                    <span className="history-value">{formatValidityWindow(item.createdTime, validUntil)}</span>
                  </div>

                  <div className="history-cell">
                    <span className="history-value">{formatExpiryTime(validUntil)}</span>
                  </div>

                  <div className="history-cell">
                    <span className="history-value">{formatEnumLabel(item.retainedStatus, 'Retained')}</span>
                  </div>

                  <div className="history-cell">
                    <span className="history-value">{formatEnumLabel(item.concreteReason, 'None')}</span>
                  </div>

                  <div className="history-cell">
                    <span className="history-value">{item.retrievable ? 'Yes' : 'No'}</span>
                  </div>

                  <div className="history-cell">
                    <span className="history-value">{formatTime(item.statusTime ?? item.createdTime)}</span>
                  </div>
                </Link>
              )
            })}
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
