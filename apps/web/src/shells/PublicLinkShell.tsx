import { Outlet } from 'react-router-dom'

export function PublicLinkShell() {
  return (
    <main className="public-link-shell centered-screen shell-screen">
      <section className="panel shell-panel public-panel">
        <Outlet />
      </section>
    </main>
  )
}
