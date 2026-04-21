import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.ts'
import { useAdminQuery } from '../hooks/useAdminQuery.ts'

export function AdminUsersPage() {
  const queryClient = useQueryClient()
  const usersQuery = useAdminQuery(['admin', 'users'], api.listUsers)

  const disableMutation = useMutation({
    mutationFn: api.disableUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'summary'] })
    },
  })

  const enableMutation = useMutation({
    mutationFn: api.enableUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'summary'] })
    },
  })

  return (
    <section className="panel page-panel admin-section-grid">
      <h2>Users</h2>
      <div className="admin-record-list">
        {usersQuery.data?.map((user) => {
          const record = user as {
            id?: string
            username?: string
            admissionState?: string
            enablementState?: string
            devices?: Array<{ id: string }>
          }

          return (
            <article key={record.id} className="admin-record-card">
              <div>
                <strong>{record.username}</strong>
                <p className="muted">
                  {record.admissionState} · {record.enablementState} · trusted devices: {record.devices?.length ?? 0}
                </p>
              </div>

              {record.id ? (
                record.enablementState === 'DISABLED' ? (
                  <button className="admin-button primary" type="button" onClick={() => enableMutation.mutate(record.id!)}>
                    Enable
                  </button>
                ) : (
                  <button className="admin-button" type="button" onClick={() => disableMutation.mutate(record.id!)}>
                    Disable
                  </button>
                )
              ) : null}
            </article>
          )
        })}
      </div>

      <div className="admin-grid two-up">
        <article className="admin-stat-card text-card">
          <span>Pending approvals</span>
          <strong>
            {
              (usersQuery.data ?? []).filter(
                (user) => (user as { admissionState?: string }).admissionState === 'PENDING_APPROVAL',
              ).length
            }
          </strong>
        </article>
        <article className="admin-stat-card text-card">
          <span>Disabled users</span>
          <strong>
            {
              (usersQuery.data ?? []).filter(
                (user) => (user as { enablementState?: string }).enablementState === 'DISABLED',
              ).length
            }
          </strong>
        </article>
      </div>
    </section>
  )
}
