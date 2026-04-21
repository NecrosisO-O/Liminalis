import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.ts'
import { useAdminQuery } from '../hooks/useAdminQuery.ts'

export function AdminInvitesPage() {
  const queryClient = useQueryClient()
  const [expiresInMinutes, setExpiresInMinutes] = useState('60')
  const invitesQuery = useAdminQuery(['admin', 'invites'], api.listInvites)

  const createMutation = useMutation({
    mutationFn: () => api.createInvite(Number(expiresInMinutes)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'invites'] })
    },
  })

  const invalidateMutation = useMutation({
    mutationFn: api.invalidateInvite,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'invites'] })
    },
  })

  return (
    <section className="panel page-panel admin-section-grid">
      <h2>Invites</h2>

      <div className="admin-inline-form">
        <input value={expiresInMinutes} onChange={(event) => setExpiresInMinutes(event.target.value)} />
        <button className="admin-button primary" type="button" onClick={() => createMutation.mutate()}>
          Create invite
        </button>
      </div>

      <div className="admin-record-list">
        {invitesQuery.data?.map((invite) => {
          const record = invite as {
            id?: string
            code?: string
            expiresAt?: string
            consumedAt?: string | null
            invalidatedAt?: string | null
          }
          return (
            <article key={record.id} className="admin-record-card">
              <div>
                <strong>{record.code}</strong>
                <p className="muted">
                  Expires: {record.expiresAt ?? 'unknown'}
                  {record.consumedAt ? ' · consumed' : ''}
                  {record.invalidatedAt ? ' · invalidated' : ''}
                </p>
              </div>
              {record.id && !record.consumedAt ? (
                <button
                  className="admin-button"
                  type="button"
                  onClick={() => invalidateMutation.mutate(record.id!)}
                >
                  Invalidate
                </button>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}
