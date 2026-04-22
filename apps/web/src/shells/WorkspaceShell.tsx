import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme.tsx'
import { useSearchQuery } from '../hooks/useSearchQuery.ts'

const navItems = [
  { to: '/app', label: 'Timeline', end: true },
  { to: '/app/upload', label: 'Upload', end: false },
  { to: '/app/history', label: 'History', end: false },
  { to: '/live/start', label: 'Live', end: false },
  { to: '/app/share-tools', label: 'Share', end: false },
  { to: '/app/settings', label: 'Settings', end: false },
] as const satisfies ReadonlyArray<{
  to: string
  label: string
  end?: boolean
}>

export function WorkspaceShell() {
  const { mode, toggle } = useTheme()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const searchPanelRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const searchQuery = useSearchQuery(searchValue)

  useEffect(() => {
    if (!searchOpen) {
      return
    }

    searchInputRef.current?.focus()

    function handlePointerDown(event: MouseEvent) {
      if (searchPanelRef.current?.contains(event.target as Node)) {
        return
      }

      setSearchOpen(false)
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSearchOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [searchOpen])

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
            <button className="icon-button" type="button" aria-label="Search" onClick={() => setSearchOpen((current) => !current)}>
              🔍
            </button>

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

          {searchOpen ? (
            <div ref={searchPanelRef} className="topbar-search-popover">
              <label className="field topbar-search-field">
                <span>Search</span>
                <input
                  ref={searchInputRef}
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search title or source"
                />
              </label>

              {searchValue.trim() === '' ? (
                <p className="muted topbar-search-note">Type to search visible metadata.</p>
              ) : searchQuery.isLoading ? (
                <p className="muted topbar-search-note">Searching...</p>
              ) : searchQuery.data && searchQuery.data.length > 0 ? (
                <div className="topbar-search-results">
                  {searchQuery.data.slice(0, 6).map((item) => (
                    <Link
                      key={item.id}
                      to={`/app/items/${item.objectId}`}
                      className="topbar-search-result"
                      onClick={() => setSearchOpen(false)}
                    >
                      <strong>{item.displayTitle ?? 'Untitled result'}</strong>
                      <span className="muted">{item.sourceLabel ?? item.visibleTypeLabel ?? 'Search result'}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="muted topbar-search-note">No matches.</p>
              )}
            </div>
          ) : null}
        </header>

        <Outlet />
      </div>
    </div>
  )
}
