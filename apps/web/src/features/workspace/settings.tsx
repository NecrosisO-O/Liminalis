import { Link } from 'react-router-dom'
import { EmptyState } from '../../shared/ui/components.tsx'

export function SettingsPage() {
  return (
    <section className="workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Settings</p>
          <h2>Workspace settings</h2>
        </div>
      </header>
      <EmptyState
        title="Device-centered settings"
        detail="Account access and recovery controls are handled through trusted-device flows."
        actions={
          <>
            <Link className="button button-primary" to="/device/pair/approve">Approve another browser</Link>
            <Link className="button button-secondary" to="/device/recovery">Recover another browser</Link>
          </>
        }
      />
    </section>
  )
}
