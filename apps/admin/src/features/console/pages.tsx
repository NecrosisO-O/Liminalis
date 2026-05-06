import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { api, type ConfidentialityLevel, type PolicyBundle } from '../../shared/api/client.ts'
import { Button, Field, Input, Select } from '../../shared/ui/components.tsx'
import { formatBytes, formatDate } from '../../shared/ui/format.ts'

const levels: ConfidentialityLevel[] = ['SECRET', 'CONFIDENTIAL', 'TOP_SECRET']
const bytesPerMiB = 1024 * 1024
const policySections = ['lifecycle', 'shareAvailability', 'userTargetedSharing', 'passwordExtraction', 'publicLinks', 'liveTransfer'] as const
type PolicySectionName = (typeof policySections)[number]
type PolicyValue = boolean | number | string | null

const sectionLabels: Record<PolicySectionName, string> = {
  lifecycle: 'Lifecycle',
  shareAvailability: 'Share availability',
  userTargetedSharing: 'User-targeted sharing',
  passwordExtraction: 'Password extraction',
  publicLinks: 'Public links',
  liveTransfer: 'Live transfer',
}

function titleize(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function bytesToMiBInput(bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined) {
    return ''
  }

  return Number.isInteger(bytes / bytesPerMiB)
    ? String(bytes / bytesPerMiB)
    : (bytes / bytesPerMiB).toFixed(2)
}

function miBInputToBytes(value: string, fallback: number | null = null) {
  const trimmed = value.trim()
  if (!trimmed) {
    return fallback
  }

  const mib = Number(trimmed)
  return Number.isFinite(mib) ? Math.round(mib * bytesPerMiB) : fallback
}

function originInputToValue(value: string) {
  return value.trim() || null
}

export function OverviewPage() {
  const summary = useQuery({ queryKey: ['admin', 'summary'], queryFn: api.getOperationsSummary })
  const storage = useQuery({ queryKey: ['admin', 'storage-users'], queryFn: api.getStorageUsers })
  const settings = useQuery({ queryKey: ['admin', 'settings'], queryFn: api.getInstanceSettings })
  const pendingStorage = storage.data?.reduce((sum, user) => sum + user.storageUsedBytes, 0) ?? 0

  return (
    <section className="admin-page">
      <header className="page-heading">
        <h2>Overview</h2>
        <p className="muted">Operational summary without content-level metadata.</p>
      </header>
      <div className="stat-grid">
        <Stat label="Users" value={summary.data?.users.totalUsers ?? 0} />
        <Stat label="Pending approvals" value={summary.data?.users.pendingUsers ?? 0} />
        <Stat label="Disabled users" value={summary.data?.users.disabledUsers ?? 0} />
        <Stat label="Trusted devices" value={summary.data?.objects.trustedDevices ?? 0} />
        <Stat label="Active invites" value={summary.data?.invites.activeInvites ?? 0} />
        <Stat label="Stored bytes" value={formatBytes(summary.data?.storage.uploadedCiphertextBytes ?? pendingStorage)} />
        <Stat label="Public origin" value={settings.data?.publicOrigin ?? 'Not set'} />
      </div>
    </section>
  )
}

export function InvitesPage() {
  const queryClient = useQueryClient()
  const [expires, setExpires] = useState('60')
  const invites = useQuery({ queryKey: ['admin', 'invites'], queryFn: api.listInvites })
  const create = useMutation({
    mutationFn: () => api.createInvite(Number(expires)),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['admin', 'invites'] }),
  })
  const invalidate = useMutation({
    mutationFn: api.invalidateInvite,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['admin', 'invites'] }),
  })

  return (
    <section className="admin-page">
      <header className="page-heading">
        <h2>Invites</h2>
      </header>
      <div className="toolbar">
        <Field label="Expires in minutes">
          <Input value={expires} onChange={(event) => setExpires(event.target.value)} inputMode="numeric" />
        </Field>
        <Button variant="primary" onClick={() => create.mutate()} disabled={create.isPending}>Create invite</Button>
      </div>
      <div className="admin-table invites-table">
        <div className="table-head"><span>Code</span><span>Expires</span><span>Status</span><span>Action</span></div>
        {invites.data?.map((invite) => {
          const status = invite.invalidatedAt ? 'Invalidated' : invite.consumedAt ? 'Consumed' : 'Active'
          return (
            <div key={invite.id} className="table-row">
              <strong>{invite.code}</strong>
              <span>{formatDate(invite.expiresAt)}</span>
              <span>{status}</span>
              <Button disabled={status !== 'Active' || invalidate.isPending} onClick={() => invalidate.mutate(invite.id)}>Invalidate</Button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function ApprovalsPage() {
  const queryClient = useQueryClient()
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: api.listUsers })
  const approve = useMutation({
    mutationFn: api.approveUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'summary'] })
    },
  })
  const pending = users.data?.filter((user) => user.admissionState === 'PENDING_APPROVAL') ?? []

  return (
    <section className="admin-page">
      <header className="page-heading"><h2>Approvals</h2></header>
      <div className="record-list">
        {pending.length === 0 ? <p className="muted">No pending users.</p> : null}
        {pending.map((user) => (
          <article key={user.id} className="record-card">
            <div><strong>{user.username}</strong><span>{user.email ?? 'No email'}</span></div>
            <Button variant="primary" onClick={() => approve.mutate(user.id)} disabled={approve.isPending}>Approve</Button>
          </article>
        ))}
      </div>
    </section>
  )
}

export function UsersPage() {
  const queryClient = useQueryClient()
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: api.listUsers })
  const storage = useQuery({ queryKey: ['admin', 'storage-users'], queryFn: api.getStorageUsers })
  const disable = useMutation({
    mutationFn: api.disableUser,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
  const enable = useMutation({
    mutationFn: api.enableUser,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })

  return (
    <section className="admin-page">
      <header className="page-heading"><h2>Users</h2><p className="muted">No transfer content metadata is exposed here.</p></header>
      <div className="admin-table users-table">
        <div className="table-head"><span>User</span><span>State</span><span>Role</span><span>Devices</span><span>Storage</span><span>Action</span></div>
        {users.data?.map((user) => {
          const storageRow = storage.data?.find((row) => row.userId === user.id)
          return (
            <div key={user.id} className="table-row">
              <strong>{user.username}</strong>
              <span>{user.admissionState} · {user.enablementState}</span>
              <span>{user.role}</span>
              <span>{user.devices?.length ?? 0}</span>
              <span>{storageRow ? `${formatBytes(storageRow.storageUsedBytes)} / ${formatBytes(storageRow.storageQuotaBytes)}` : 'Loading'}</span>
              {user.enablementState === 'DISABLED' ? (
                <Button onClick={() => enable.mutate(user.id)} disabled={enable.isPending}>Enable</Button>
              ) : (
                <Button variant="danger" onClick={() => disable.mutate(user.id)} disabled={disable.isPending}>Disable</Button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function StoragePage() {
  const queryClient = useQueryClient()
  const storage = useQuery({ queryKey: ['admin', 'storage-users'], queryFn: api.getStorageUsers })
  const settings = useQuery({ queryKey: ['admin', 'settings'], queryFn: api.getInstanceSettings })
  const [defaultQuotaMiB, setDefaultQuotaMiB] = useState<string | null>(null)
  const [userQuota, setUserQuota] = useState<Record<string, string>>({})
  const setQuota = useMutation({
    mutationFn: ({ userId, quotaBytes }: { userId: string | null; quotaBytes: number | null }) => api.setStorageQuota(userId, quotaBytes),
    onSuccess: async () => {
      setDefaultQuotaMiB(null)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'storage-users'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'summary'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
    },
  })
  const displayedDefaultQuotaMiB = defaultQuotaMiB ?? (bytesToMiBInput(settings.data?.defaultStorageQuotaBytes) || '1024')

  return (
    <section className="admin-page">
      <header className="page-heading"><h2>Storage</h2></header>
      <div className="toolbar">
        <Field label="Default quota MiB">
          <Input
            value={displayedDefaultQuotaMiB}
            onChange={(event) => setDefaultQuotaMiB(event.target.value)}
            inputMode="decimal"
          />
        </Field>
        <Button
          variant="primary"
          onClick={() => setQuota.mutate({ userId: null, quotaBytes: miBInputToBytes(displayedDefaultQuotaMiB, settings.data?.defaultStorageQuotaBytes ?? null) })}
        >
          Set default quota
        </Button>
      </div>
      <div className="admin-table storage-table">
        <div className="table-head"><span>User</span><span>Used</span><span>Quota</span><span>Custom quota MiB</span><span>Action</span></div>
        {storage.data?.map((row) => (
          <div key={row.userId} className="table-row">
            <strong>{row.username}</strong>
            <span>{formatBytes(row.storageUsedBytes)}</span>
            <span>{formatBytes(row.storageQuotaBytes)}{row.hasCustomQuota ? ' · custom' : ''}</span>
            <Input value={userQuota[row.userId] ?? ''} onChange={(event) => setUserQuota((current) => ({ ...current, [row.userId]: event.target.value }))} placeholder="Blank resets" inputMode="decimal" />
            <Button onClick={() => setQuota.mutate({ userId: row.userId, quotaBytes: miBInputToBytes(userQuota[row.userId] ?? '') })}>Apply</Button>
          </div>
        ))}
      </div>
    </section>
  )
}

export function PolicyPage() {
  const queryClient = useQueryClient()
  const policy = useQuery({ queryKey: ['admin', 'policy'], queryFn: api.getPolicyState })
  const [level, setLevel] = useState<ConfidentialityLevel>('SECRET')
  const [defaultLevel, setDefaultLevel] = useState<ConfidentialityLevel>('SECRET')
  const selected = useMemo(() => policy.data?.currentBundles.find((bundle) => bundle.levelName === level), [level, policy.data])
  const [draft, setDraft] = useState<PolicyBundle | null>(null)
  const activeDraft = draft?.levelName === level ? draft : selected ?? null
  const history = useQuery({ queryKey: ['admin', 'policy-history', level], queryFn: () => api.getPolicyHistory(level) })
  const publish = useMutation({
    mutationFn: () => {
      if (!activeDraft) {
        throw new Error('No policy bundle loaded.')
      }

      return api.publishPolicy({
        levelName: level,
        lifecycle: activeDraft.lifecycle,
        shareAvailability: activeDraft.shareAvailability,
        userTargetedSharing: activeDraft.userTargetedSharing,
        passwordExtraction: activeDraft.passwordExtraction,
        publicLinks: activeDraft.publicLinks,
        liveTransfer: activeDraft.liveTransfer,
        defaultConfidentialityLevel: defaultLevel,
      })
    },
    onSuccess: async () => {
      setDraft(null)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'policy'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'policy-history', level] })
    },
  })
  const restore = useMutation({
    mutationFn: () => api.restorePolicyDefaults(defaultLevel),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['admin', 'policy'] }),
  })

  function updateSection(section: PolicySectionName, key: string, value: PolicyValue) {
    if (!activeDraft) {
      return
    }

    setDraft({
      ...activeDraft,
      [section]: {
        ...activeDraft[section],
        [key]: value,
      },
    })
  }

  function updateInputSection(section: PolicySectionName, key: string, value: string, current: PolicyValue) {
    const parsed: PolicyValue =
      current === null && value.trim() === ''
        ? null
        : typeof current === 'number'
          ? (value.trim() === '' ? null : Number(value))
          : value
    updateSection(section, key, parsed)
  }

  return (
    <section className="admin-page">
      <header className="page-heading"><h2>Policy</h2><p className="muted">The three confidentiality levels are fixed; only strategy fields are editable.</p></header>
      <div className="toolbar">
        <Field label="Level"><Select value={level} onChange={(event) => { setLevel(event.target.value as ConfidentialityLevel); setDraft(null) }}>{levels.map((entry) => <option key={entry}>{entry}</option>)}</Select></Field>
        <Field label="Default level"><Select value={defaultLevel} onChange={(event) => setDefaultLevel(event.target.value as ConfidentialityLevel)}>{levels.map((entry) => <option key={entry}>{entry}</option>)}</Select></Field>
        <Button variant="primary" onClick={() => publish.mutate()} disabled={!activeDraft || publish.isPending}>Publish</Button>
        <Button onClick={() => restore.mutate()} disabled={restore.isPending}>Restore defaults</Button>
      </div>
      {activeDraft ? (
        <div className="policy-grid">
          {policySections.map((section) => (
            <section key={section} className="policy-section">
              <h3>{sectionLabels[section]}</h3>
              {Object.entries(activeDraft[section]).map(([key, value]) => (
                <PolicyField
                  key={key}
                  fieldKey={key}
                  value={value}
                  onChange={(nextValue) => updateSection(section, key, nextValue)}
                  onInputChange={(nextValue) => updateInputSection(section, key, nextValue, value)}
                />
              ))}
            </section>
          ))}
        </div>
      ) : <p className="muted">Loading policy bundle.</p>}
      <section className="history-strip">
        <strong>History</strong>
        <span>{history.data?.length ?? 0} bundle versions for {level}</span>
      </section>
      {publish.error instanceof Error ? <p className="error-text">{publish.error.message}</p> : null}
      {restore.error instanceof Error ? <p className="error-text">{restore.error.message}</p> : null}
    </section>
  )
}

function PolicyField({
  fieldKey,
  value,
  onChange,
  onInputChange,
}: {
  fieldKey: string
  value: PolicyValue
  onChange: (value: PolicyValue) => void
  onInputChange: (value: string) => void
}) {
  if (typeof value === 'boolean') {
    return (
      <label className="policy-row policy-row-switch">
        <span>
          <strong>{titleize(fieldKey)}</strong>
          <small>{fieldKey}</small>
        </span>
        <button
          type="button"
          className={`switch ${value ? 'is-on' : ''}`}
          role="switch"
          aria-checked={value}
          onClick={() => onChange(!value)}
        >
          <span>{value ? 'On' : 'Off'}</span>
        </button>
      </label>
    )
  }

  return (
    <label className="policy-row">
      <span>
        <strong>{titleize(fieldKey)}</strong>
        <small>{fieldKey}</small>
      </span>
      <Input
        className="policy-input"
        value={value === null ? '' : String(value)}
        placeholder={value === null ? 'No limit' : undefined}
        inputMode={typeof value === 'number' || value === null ? 'decimal' : undefined}
        onChange={(event) => onInputChange(event.target.value)}
      />
    </label>
  )
}

export function SettingsPage() {
  const queryClient = useQueryClient()
  const settings = useQuery({ queryKey: ['admin', 'settings'], queryFn: api.getInstanceSettings })
  const [publicOrigin, setPublicOrigin] = useState<string | null>(null)
  const [quotaMiB, setQuotaMiB] = useState<string | null>(null)
  const displayedPublicOrigin = publicOrigin ?? settings.data?.publicOrigin ?? ''
  const displayedQuotaMiB = quotaMiB ?? (bytesToMiBInput(settings.data?.defaultStorageQuotaBytes) || '1024')
  const previewOrigin = displayedPublicOrigin.trim() || window.location.origin
  const save = useMutation({
    mutationFn: () => api.updateInstanceSettings({
      publicOrigin: originInputToValue(displayedPublicOrigin),
      defaultStorageQuotaBytes: miBInputToBytes(displayedQuotaMiB, settings.data?.defaultStorageQuotaBytes ?? null) ?? undefined,
    }),
    onSuccess: async () => {
      setPublicOrigin(null)
      setQuotaMiB(null)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'storage-users'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'summary'] })
    },
  })

  return (
    <section className="admin-page settings-page">
      <header className="page-heading">
        <h2>Settings</h2>
        <p className="muted">Instance-wide references used by generated recipient URLs and admin defaults.</p>
      </header>
      <section className="settings-panel">
        <Field label="Public origin">
          <Input
            value={displayedPublicOrigin}
            onChange={(event) => setPublicOrigin(event.target.value)}
            placeholder="https://example.example"
          />
        </Field>
        <Field label="Default storage quota MiB">
          <Input value={displayedQuotaMiB} onChange={(event) => setQuotaMiB(event.target.value)} inputMode="decimal" />
        </Field>
        <div className="settings-preview">
          <span>Public link preview</span>
          <strong>{`${previewOrigin}/p/example#k=secret`}</strong>
        </div>
        <Button variant="primary" onClick={() => save.mutate()} disabled={save.isPending}>
          Save settings
        </Button>
        {save.error instanceof Error ? <p className="error-text">{save.error.message}</p> : null}
      </section>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}
