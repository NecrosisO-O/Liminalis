import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.ts'

export function AdminLoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const loginMutation = useMutation({
    mutationFn: () => api.login(username, password),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'summary'] })
      navigate('/admin', { replace: true })
    },
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    loginMutation.mutate()
  }

  return (
    <main className="centered-screen">
      <section className="panel auth-panel admin-auth-card">
        <p className="eyebrow">Liminalis Admin</p>
        <h1>Admin sign in</h1>
        <p className="muted">Use the same account session system, with admin role required for control-plane access.</p>

        <form className="admin-form" onSubmit={handleSubmit}>
          <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
          />
          <button className="admin-button primary" type="submit" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}
