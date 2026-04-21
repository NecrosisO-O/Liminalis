import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSearchQuery } from '../hooks/useSearchQuery.ts'

function formatTime(input: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(input))
}

export function AppSearchPage() {
  const [query, setQuery] = useState('')
  const searchQuery = useSearchQuery(query)

  return (
    <section className="workspace-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Search</p>
          <h2>Trusted-device search</h2>
          <p className="muted">Searches the approved narrow visible metadata set only.</p>
        </div>
      </header>

      <section className="panel page-panel search-panel">
        <label className="field search-field">
          <span>Query</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, summary, or source" />
        </label>

        {query.trim() === '' ? (
          <p className="muted">Enter a query to search visible metadata.</p>
        ) : searchQuery.isLoading ? (
          <p className="muted">Searching...</p>
        ) : searchQuery.data && searchQuery.data.length > 0 ? (
          <div className="record-list">
            {searchQuery.data.map((item) => (
              <Link key={item.id} to={`/app/items/${item.objectId}`} className="record-card record-link-card">
                <div>
                  <strong>{item.displayTitle ?? 'Untitled result'}</strong>
                  <p className="muted">
                    {item.visibleSummary ?? item.sourceLabel ?? item.visibleTypeLabel ?? 'Visible metadata result'}
                  </p>
                </div>
                <div className="record-side">
                  <span>{item.visibleStatusLabel ?? 'match'}</span>
                  <span>{formatTime(item.updatedAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="muted">No visible metadata matched this query.</p>
        )}
      </section>
    </section>
  )
}
