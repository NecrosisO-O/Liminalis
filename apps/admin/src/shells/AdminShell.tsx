import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api } from '../lib/api.ts'

const navItems = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/invites', label: 'Invites', end: false },
  { to: '/admin/approvals', label: 'Approvals', end: false },
  { to: '/admin/users', label: 'Users', end: false },
  { to: '/admin/policy', label: 'Policy', end: false },
  { to: '/admin/system', label: 'System', end: false },
] as const satisfies ReadonlyArray<{
  to: string
  label: string
  end?: boolean
}>

export function AdminShell() {
  const navigate = useNavigate()
  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      navigate('/login', { replace: true })
    },
  })

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand-block">
          <span className="brand-eyebrow">Liminalis</span>
          <strong>Admin Console</strong>
        </div>

        <nav className="admin-nav" aria-label="Admin navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end === true}
              className={({ isActive }) =>
                isActive ? 'admin-nav-link active' : 'admin-nav-link'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-actions">
          <a className="secondary-link" href="http://localhost:5173/app">
            Return to Workspace
          </a>
          <button className="admin-button" type="button" onClick={() => logoutMutation.mutate()}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="page-header compact">
          <div>
            <p className="eyebrow">Control Plane</p>
            <h1>Administrative surfaces</h1>
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  )
}
