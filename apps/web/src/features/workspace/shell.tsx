import { useMutation, useQueryClient } from '@tanstack/react-query'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { api } from '../../shared/api/client.ts'
import { Button, IconButton } from '../../shared/ui/components.tsx'

const navItems: ReadonlyArray<{ to: string; label: string; end?: boolean }> = [
  { to: '/app', label: 'Timeline', end: true },
  { to: '/app/upload', label: 'Advanced upload' },
  { to: '/app/history', label: 'History' },
  { to: '/live/start', label: 'Live transfer' },
  { to: '/app/settings', label: 'Settings' },
]

export function WorkspaceShell() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [menuOpen, setMenuOpen] = useState(false)

  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: async () => {
      await queryClient.clear()
      navigate('/login', { replace: true })
    },
  })

  return (
    <div className="app-shell">
      <aside className={`app-sidebar ${menuOpen ? 'menu-open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">L</span>
          <div>
            <strong>Liminalis</strong>
            <span>Trusted workspace</span>
          </div>
        </div>
        <IconButton
          label={menuOpen ? 'Close menu' : 'Open menu'}
          className="mobile-menu-button"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">{menuOpen ? 'x' : '☰'}</span>
        </IconButton>
        <div className="sidebar-menu">
          <nav className="nav-list" aria-label="Workspace navigation">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-footer">
            <a href="http://localhost:3001/admin" onClick={() => setMenuOpen(false)}>Admin site</a>
            <Button
              variant="ghost"
              onClick={() => {
                setMenuOpen(false)
                logout.mutate()
              }}
              disabled={logout.isPending}
            >
              Sign out
            </Button>
          </div>
        </div>
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
