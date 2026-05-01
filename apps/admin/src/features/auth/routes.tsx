import { useMutation, useQuery } from '@tanstack/react-query'
import { Navigate, Outlet, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { api, ApiError } from '../../shared/api/client.ts'
import { Button, Field, Input, StatusPanel } from '../../shared/ui/components.tsx'

export function AdminGate() {
  const summary = useQuery({
    queryKey: ['admin', 'summary'],
    queryFn: api.getOperationsSummary,
    retry: false,
  })

  if (summary.isLoading) {
    return <StatusPanel title="Checking admin access" detail="Verifying session and control-plane permissions." />
  }

  if (summary.isError) {
    if (summary.error instanceof ApiError && summary.error.status === 401) {
      return <Navigate to="/login" replace />
    }

    return <StatusPanel title="Admin access required" detail="This session cannot use the independent control plane." />
  }

  return <Outlet />
}

export function AdminLoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const login = useMutation({
    mutationFn: () => api.login(username, password),
    onSuccess: () => navigate('/admin', { replace: true }),
  })

  return (
    <main className="center-screen">
      <section className="auth-panel">
        <p className="eyebrow">Liminalis Admin</p>
        <h1>Sign in</h1>
        <p className="muted">Use an administrator account for this separate control plane.</p>
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault()
            login.mutate()
          }}
        >
          <Field label="Username">
            <Input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
          </Field>
          <Field label="Password" error={login.error instanceof Error ? login.error.message : null}>
            <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required />
          </Field>
          <Button variant="primary" type="submit" disabled={login.isPending}>
            {login.isPending ? 'Signing in' : 'Sign in'}
          </Button>
        </form>
      </section>
    </main>
  )
}
