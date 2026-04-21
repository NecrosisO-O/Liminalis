import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api.ts'

export function RegisterPage() {
  const [inviteCode, setInviteCode] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')

  const registerMutation = useMutation({
    mutationFn: api.register,
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    registerMutation.mutate({
      inviteCode,
      username,
      password,
      email: email.trim() === '' ? undefined : email,
    })
  }

  if (registerMutation.isSuccess) {
    return (
      <section className="surface-card auth-card">
        <p className="eyebrow">Entry</p>
        <h2>Account created</h2>
        <p className="muted">
          Your account has been registered successfully. An administrator still needs to approve it before normal use.
        </p>
        <Link className="primary-button button-link" to="/login">
          Go to sign in
        </Link>
      </section>
    )
  }

  const errorMessage =
    registerMutation.error instanceof ApiError || registerMutation.error instanceof Error
      ? registerMutation.error.message
      : null

  return (
    <section className="surface-card auth-card">
      <p className="eyebrow">Entry</p>
      <h2>Create account</h2>
      <p className="muted">Register with an invite code for this Liminalis instance.</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Invite code</span>
          <input
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
            required
          />
        </label>

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

        <label className="field">
          <span>Email (optional)</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

        <button className="primary-button" type="submit" disabled={registerMutation.isPending}>
          {registerMutation.isPending ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="muted helper-row">
        Already registered? <Link to="/login">Sign in</Link>
      </p>
    </section>
  )
}
