import { Navigate, Outlet } from 'react-router-dom'
import { api, ApiError } from '../lib/api.ts'
import { useAdminQuery } from '../hooks/useAdminQuery.ts'

export function AdminRouteResolver() {
  const summaryQuery = useAdminQuery(['admin', 'summary'], api.getOperationsSummary)

  if (summaryQuery.isLoading) {
    return (
      <main className="centered-screen">
        <section className="panel auth-panel">
          <p className="eyebrow">Liminalis Admin</p>
          <h1>Checking admin access</h1>
          <p className="muted">Verifying session and control-plane permissions.</p>
        </section>
      </main>
    )
  }

  if (summaryQuery.isError) {
    if (summaryQuery.error instanceof ApiError && summaryQuery.error.status === 401) {
      return <Navigate to="/login" replace />
    }

    if (summaryQuery.error instanceof ApiError && summaryQuery.error.status === 403) {
      return (
        <main className="centered-screen">
          <section className="panel auth-panel">
            <p className="eyebrow">Liminalis Admin</p>
            <h1>Admin role required</h1>
            <p className="muted">This session does not have control-plane permissions.</p>
          </section>
        </main>
      )
    }
  }

  return <Outlet />
}
