import { api } from '../lib/api.ts'
import { useAdminQuery } from '../hooks/useAdminQuery.ts'

export function AdminOverviewPage() {
  const summaryQuery = useAdminQuery(['admin', 'summary'], api.getOperationsSummary)

  return (
    <section className="panel page-panel">
      <h2>Overview</h2>
      {summaryQuery.isLoading ? (
        <p className="muted">Loading operational summary.</p>
      ) : summaryQuery.data ? (
        <div className="admin-grid">
          <article className="admin-stat-card">
            <span>Users</span>
            <strong>{summaryQuery.data.users.totalUsers}</strong>
          </article>
          <article className="admin-stat-card">
            <span>Pending approvals</span>
            <strong>{summaryQuery.data.users.pendingUsers}</strong>
          </article>
          <article className="admin-stat-card">
            <span>Active invites</span>
            <strong>{summaryQuery.data.invites.activeInvites}</strong>
          </article>
          <article className="admin-stat-card">
            <span>Trusted devices</span>
            <strong>{summaryQuery.data.objects.trustedDevices}</strong>
          </article>
          <article className="admin-stat-card">
            <span>Source items</span>
            <strong>{summaryQuery.data.objects.sourceItems}</strong>
          </article>
          <article className="admin-stat-card">
            <span>Uploaded ciphertext bytes</span>
            <strong>{summaryQuery.data.storage.uploadedCiphertextBytes}</strong>
          </article>
        </div>
      ) : null}
    </section>
  )
}
