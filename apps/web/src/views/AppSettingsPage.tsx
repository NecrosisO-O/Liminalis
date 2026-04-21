import { useTheme } from '../hooks/useTheme.tsx'

export function AppSettingsPage() {
  const { mode, toggle } = useTheme()

  return (
    <section className="workspace-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h2>Workspace settings</h2>
          <p className="muted">Theme and browser-local controls live here as the settings surface expands.</p>
        </div>
      </header>

      <section className="panel page-panel settings-panel">
        <div className="settings-row">
          <div>
            <strong>Theme mode</strong>
            <p className="muted">Light and dark mode use the same information hierarchy.</p>
          </div>

          <button className="secondary-button" type="button" onClick={toggle}>
            Switch to {mode === 'dark' ? 'light' : 'dark'} mode
          </button>
        </div>
      </section>
    </section>
  )
}
