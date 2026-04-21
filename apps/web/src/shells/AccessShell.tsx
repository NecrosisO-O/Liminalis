import { Outlet } from 'react-router-dom'

export function AccessShell() {
  return (
    <main className="access-shell centered-screen shell-screen">
      <section className="panel shell-panel flow-panel">
        <Outlet />
      </section>
    </main>
  )
}
