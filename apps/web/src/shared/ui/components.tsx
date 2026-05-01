import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { clsx } from 'clsx'

export function Button({
  children,
  variant = 'secondary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return (
    <button className={clsx('button', `button-${variant}`, className)} {...props}>
      {children}
    </button>
  )
}

export function IconButton({
  children,
  label,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button className={clsx('icon-button', className)} type="button" aria-label={label} title={label} {...props}>
      {children}
    </button>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string | null
  children: ReactNode
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx('input', props.className)} {...props} />
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={clsx('input', props.className)} {...props} />
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx('input textarea', props.className)} {...props} />
}

export function StatusView({
  eyebrow,
  title,
  detail,
  actions,
  tone = 'neutral',
}: {
  eyebrow?: string
  title: string
  detail?: string
  actions?: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}) {
  return (
    <section className={clsx('status-view', `status-${tone}`)}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1>{title}</h1>
      {detail ? <p className="muted">{detail}</p> : null}
      {actions ? <div className="actions">{actions}</div> : null}
    </section>
  )
}

export function EmptyState({ title, detail, actions }: { title: string; detail?: string; actions?: ReactNode }) {
  return (
    <section className="empty-state">
      <h2>{title}</h2>
      {detail ? <p className="muted">{detail}</p> : null}
      {actions ? <div className="actions">{actions}</div> : null}
    </section>
  )
}

export function Toast({ tone = 'neutral', children }: { tone?: 'neutral' | 'success' | 'warning' | 'danger'; children: ReactNode }) {
  return <div className={clsx('toast', `toast-${tone}`)}>{children}</div>
}

export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="dialog" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header className="dialog-header">
          <h2>{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            x
          </IconButton>
        </header>
        {children}
      </section>
    </div>
  )
}
