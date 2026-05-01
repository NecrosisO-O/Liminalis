import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { api } from '../../shared/api/client.ts'
import { Button, IconButton, TextInput } from '../../shared/ui/components.tsx'

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
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')

  const search = useQuery({
    queryKey: ['search', query],
    queryFn: () => api.search(query),
    enabled: query.trim().length > 0,
  })

  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: async () => {
      await queryClient.clear()
      navigate('/login', { replace: true })
    },
  })

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand">
          <span className="brand-mark">L</span>
          <div>
            <strong>Liminalis</strong>
            <span>Trusted workspace</span>
          </div>
        </div>
        <nav className="nav-list" aria-label="Workspace navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <a href="http://localhost:3001/admin">Admin site</a>
          <Button variant="ghost" onClick={() => logout.mutate()} disabled={logout.isPending}>
            Sign out
          </Button>
        </div>
      </aside>
      <main className="app-main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Self-hosted encrypted transfer</p>
            <h1>Workspace</h1>
          </div>
          <div className="topbar-actions">
            <IconButton label="Search visible metadata" onClick={() => setSearchOpen((open) => !open)}>
              <span aria-hidden="true">⌕</span>
            </IconButton>
          </div>
          {searchOpen ? (
            <section className="search-popover">
              <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search visible metadata" autoFocus />
              <div className="search-results">
                {query.trim() === '' ? <p className="muted">Search titles, source labels, visible type, and status.</p> : null}
                {search.isLoading ? <p className="muted">Searching...</p> : null}
                {search.data?.map((item) => (
                  <Link key={item.id} to={`/app/items/${item.sourceObjectId}`} onClick={() => setSearchOpen(false)}>
                    <strong>{item.displayTitle ?? 'Untitled item'}</strong>
                    <span>{item.sourceLabel} · {item.visibleTypeLabel}</span>
                  </Link>
                ))}
                {query.trim() !== '' && search.data?.length === 0 ? <p className="muted">No matches.</p> : null}
              </div>
            </section>
          ) : null}
        </header>
        <Outlet />
      </main>
    </div>
  )
}
