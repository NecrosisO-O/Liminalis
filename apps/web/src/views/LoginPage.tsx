import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api.ts'
import { resolveBootstrapPath } from '../lib/routing.ts'

export function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bootstrap'] })
      const bootstrap = await api.bootstrap()
      navigate(resolveBootstrapPath(bootstrap), { replace: true })
    },
  })

  const errorMessage =
    loginMutation.error instanceof ApiError && loginMutation.error.status === 401
      ? 'Invalid username or password.'
      : loginMutation.error instanceof Error
        ? loginMutation.error.message
        : null

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    loginMutation.mutate({ username, password })
  }

  return (
    <section className="surface-card auth-card">
      <p className="eyebrow">Entry</p>
      <h2>Sign in</h2>
      <p className="muted">Use your username and password to enter this Liminalis instance.</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Username</span>
          <input value={username} onChange={(event) => setUsername(event.target.value)} required />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

        <button className="primary-button" type="submit" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="muted helper-row">
        Need an account? <Link to="/register">Register with invite code</Link>
      </p>
    </section>
  )
}
