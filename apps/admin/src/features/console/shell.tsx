import { useMutation, useQueryClient } from '@tanstack/react-query'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api } from '../../shared/api/client.ts'
import { Button } from '../../shared/ui/components.tsx'

const navItems: ReadonlyArray<{ to: string; label: string; end?: boolean }> = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/invites', label: 'Invites' },
  { to: '/admin/approvals', label: 'Approvals' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/policy', label: 'Policy' },
  { to: '/admin/storage', label: 'Storage' },
]

export function AdminShell() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: async () => {
      await queryClient.clear()
      navigate('/login', { replace: true })
    },
  })

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand">
          <span>L</span>
          <div>
            <strong>Liminalis</strong>
            <small>Control plane</small>
          </div>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <a href="http://localhost:5173/app">Workspace</a>
          <Button variant="ghost" onClick={() => logout.mutate()} disabled={logout.isPending}>Sign out</Button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="eyebrow">Independent admin site</p>
            <h1>Operations</h1>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  )
}
