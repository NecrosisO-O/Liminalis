import { Outlet } from 'react-router-dom'

export function EntryShell() {
  return (
    <main className="entry-shell centered-screen shell-screen">
      <section className="panel shell-panel entry-panel">
        <div className="shell-copy">
          <p className="eyebrow">Liminalis</p>
          <h1>Enter this instance</h1>
          <p className="muted">
            Account entry stays separate from trusted-device access and ordinary workspace use.
          </p>
        </div>
        <Outlet />
      </section>
    </main>
  )
}
