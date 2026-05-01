import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { clsx } from 'clsx'

export function Button({
  variant = 'secondary',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return (
    <button className={clsx('button', `button-${variant}`, className)} {...props}>
      {children}
    </button>
  )
}

export function Field({ label, children, error }: { label: string; children: ReactNode; error?: string | null }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error ? <small className="error-text">{error}</small> : null}
    </label>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx('input', props.className)} {...props} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={clsx('input', props.className)} {...props} />
}

export function StatusPanel({ title, detail }: { title: string; detail?: string }) {
  return (
    <main className="center-screen">
      <section className="auth-panel">
        <p className="eyebrow">Liminalis Admin</p>
        <h1>{title}</h1>
        {detail ? <p className="muted">{detail}</p> : null}
      </section>
    </main>
  )
}
