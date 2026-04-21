import { api } from '../lib/api.ts'
import { useAdminQuery } from '../hooks/useAdminQuery.ts'

export function AdminSystemPage() {
  const summaryQuery = useAdminQuery(['admin', 'summary'], api.getOperationsSummary)

  return (
    <section className="panel page-panel admin-section-grid">
      <h2>System</h2>
      {summaryQuery.data ? (
        <div className="admin-grid two-up">
          <article className="admin-stat-card text-card">
            <span>Uploaded ciphertext bytes</span>
            <strong>{summaryQuery.data.storage.uploadedCiphertextBytes}</strong>
          </article>
          <article className="admin-stat-card text-card">
            <span>Consumed invites</span>
            <strong>{summaryQuery.data.invites.consumedInvites}</strong>
          </article>
        </div>
      ) : (
        <p className="muted">Loading system summary.</p>
      )}
    </section>
  )
}
