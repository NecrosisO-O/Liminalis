import { useState } from 'react'
import { api } from '../lib/api.ts'
import { useAdminQuery } from '../hooks/useAdminQuery.ts'

const levels = ['SECRET', 'CONFIDENTIAL', 'TOP_SECRET'] as const

export function AdminPolicyPage() {
  const [selectedLevel, setSelectedLevel] = useState<(typeof levels)[number]>('SECRET')
  const policyQuery = useAdminQuery(['admin', 'policy'], api.getPolicyState)
  const historyQuery = useAdminQuery(['admin', 'policy-history', selectedLevel], () =>
    api.getPolicyHistory(selectedLevel),
  )

  return (
    <section className="panel page-panel admin-section-grid">
      <div className="policy-header">
        <div>
          <h2>Policy</h2>
          <p className="muted">Compact header plus fixed confidentiality tabs.</p>
        </div>
        <div className="policy-header-side">
          <span className="muted">Default level</span>
          <strong>{policyQuery.data?.defaultConfidentialityLevel ?? 'loading'}</strong>
        </div>
      </div>

      <div className="policy-tabs">
        {levels.map((level) => (
          <button
            key={level}
            className={level === selectedLevel ? 'admin-button primary' : 'admin-button'}
            type="button"
            onClick={() => setSelectedLevel(level)}
          >
            {level.toLowerCase()}
          </button>
        ))}
      </div>

      <div className="admin-grid two-up">
        <section className="admin-stat-card text-card">
          <span>Current bundle</span>
          <strong>
            {
              policyQuery.data?.currentBundles.find(
                (bundle) => (bundle as { levelName?: string }).levelName === selectedLevel,
              )
                ? ((policyQuery.data.currentBundles.find(
                    (bundle) => (bundle as { levelName?: string }).levelName === selectedLevel,
                  ) as { bundleVersion?: number }).bundleVersion ?? 'unknown')
                : 'unknown'
            }
          </strong>
        </section>

        <section className="admin-stat-card text-card">
          <span>History entries</span>
          <strong>{historyQuery.data?.length ?? 0}</strong>
        </section>
      </div>
    </section>
  )
}
