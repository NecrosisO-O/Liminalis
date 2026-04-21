import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.ts'
import { useAdminQuery } from '../hooks/useAdminQuery.ts'

export function AdminApprovalsPage() {
  const queryClient = useQueryClient()
  const usersQuery = useAdminQuery(['admin', 'users'], api.listUsers)

  const approveMutation = useMutation({
    mutationFn: api.approveUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'summary'] })
    },
  })

  const pendingUsers = (usersQuery.data ?? []).filter((user) => (user as { admissionState?: string }).admissionState === 'PENDING_APPROVAL')

  return (
    <section className="panel page-panel admin-section-grid">
      <h2>Approvals</h2>
      <div className="admin-record-list">
        {pendingUsers.map((user) => {
          const record = user as { id?: string; username?: string; email?: string | null }
          return (
            <article key={record.id} className="admin-record-card">
              <div>
                <strong>{record.username}</strong>
                <p className="muted">{record.email ?? 'No email provided'}</p>
              </div>
              {record.id ? (
                <button className="admin-button primary" type="button" onClick={() => approveMutation.mutate(record.id!)}>
                  Approve
                </button>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}
