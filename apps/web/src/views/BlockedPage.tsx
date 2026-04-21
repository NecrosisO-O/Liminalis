import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.ts'
import { resolveBootstrapPath } from '../lib/routing.ts'
import { useBootstrapQuery } from '../hooks/useBootstrapQuery.ts'

export function BlockedPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const bootstrapQuery = useBootstrapQuery()

  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSuccess: async () => {
      await queryClient.removeQueries({ queryKey: ['bootstrap'] })
      navigate('/login', { replace: true })
    },
  })

  async function refreshStatus() {
    const result = await bootstrapQuery.refetch()
    if (result.data) {
      const path = resolveBootstrapPath(result.data)
      if (path !== '/blocked') {
        navigate(path, { replace: true })
      }
    }
  }

  return (
    <section className="surface-card status-card">
      <p className="eyebrow">Access</p>
      <h2>Account disabled</h2>
      <p className="muted">
        This account is currently not allowed to access this Liminalis instance.
      </p>
      <div className="button-row">
        <button
          className="primary-button"
          type="button"
          disabled={logoutMutation.isPending}
          onClick={() => logoutMutation.mutate()}
        >
          Sign out
        </button>
        <button className="secondary-button" type="button" onClick={() => void refreshStatus()}>
          Refresh status
        </button>
      </div>
    </section>
  )
}
