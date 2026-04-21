import { NavLink, Outlet } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme.tsx'

const navItems = [
  { to: '/app', label: 'Timeline', end: true },
  { to: '/app/history', label: 'History', end: false },
  { to: '/live/start', label: 'Live', end: false },
  { to: '/app/search', label: 'Search', end: false },
  { to: '/app/share-tools', label: 'Share', end: false },
  { to: '/app/settings', label: 'Settings', end: false },
] as const satisfies ReadonlyArray<{
  to: string
  label: string
  end?: boolean
}>

export function WorkspaceShell() {
  const { mode, toggle } = useTheme()

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="brand-block">
          <span className="brand-eyebrow">Liminalis</span>
          <strong>Workspace</strong>
        </div>

        <nav className="workspace-nav" aria-label="Workspace navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end === true}
              className={({ isActive }) =>
                isActive ? 'workspace-nav-link active' : 'workspace-nav-link'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <a className="secondary-link" href="http://localhost:3001/admin">
          Admin Console
        </a>
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <div>
            <p className="eyebrow">Trusted Workspace</p>
            <h1>Liminalis</h1>
          </div>

          <div className="topbar-actions">
            <NavLink className="icon-button" to="/app/search" aria-label="Search">
              🔍
            </NavLink>

            <button
              className={mode === 'dark' ? 'theme-switch dark' : 'theme-switch'}
              type="button"
              onClick={toggle}
              aria-label="Toggle dark mode"
              aria-pressed={mode === 'dark'}
            >
              <span className="theme-switch-thumb" />
            </button>
          </div>
        </header>

        <Outlet />
      </div>
    </div>
  )
}
