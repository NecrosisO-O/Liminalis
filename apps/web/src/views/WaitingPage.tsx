import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.ts'
import { resolveBootstrapPath } from '../lib/routing.ts'
import { useBootstrapQuery } from '../hooks/useBootstrapQuery.ts'

export function WaitingPage() {
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
      if (path !== '/waiting') {
        navigate(path, { replace: true })
      }
    }
  }

  return (
    <section className="surface-card status-card">
      <p className="eyebrow">Access</p>
      <h2>Waiting for approval</h2>
      <p className="muted">
        Your account is signed in, but an administrator still needs to approve access to this instance.
      </p>
      <div className="button-row">
        <button className="primary-button" type="button" onClick={() => void refreshStatus()}>
          Refresh status
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={logoutMutation.isPending}
          onClick={() => logoutMutation.mutate()}
        >
          Sign out
        </button>
      </div>
    </section>
  )
}
