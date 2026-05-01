import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { api, type ConfidentialityLevel, type PolicyBundle } from '../../shared/api/client.ts'
import { Button, Field, Input, Select } from '../../shared/ui/components.tsx'
import { formatBytes, formatDate } from '../../shared/ui/format.ts'

const levels: ConfidentialityLevel[] = ['SECRET', 'CONFIDENTIAL', 'TOP_SECRET']

export function OverviewPage() {
  const summary = useQuery({ queryKey: ['admin', 'summary'], queryFn: api.getOperationsSummary })
  const storage = useQuery({ queryKey: ['admin', 'storage-users'], queryFn: api.getStorageUsers })
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
  const [defaultQuota, setDefaultQuota] = useState('1073741824')
  const [userQuota, setUserQuota] = useState<Record<string, string>>({})
  const setQuota = useMutation({
    mutationFn: ({ userId, quotaBytes }: { userId: string | null; quotaBytes: number | null }) => api.setStorageQuota(userId, quotaBytes),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'storage-users'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'summary'] })
    },
  })

  return (
    <section className="admin-page">
      <header className="page-heading"><h2>Storage</h2></header>
      <div className="toolbar">
        <Field label="Default quota bytes"><Input value={defaultQuota} onChange={(event) => setDefaultQuota(event.target.value)} /></Field>
        <Button variant="primary" onClick={() => setQuota.mutate({ userId: null, quotaBytes: Number(defaultQuota) })}>Set default quota</Button>
      </div>
      <div className="admin-table storage-table">
        <div className="table-head"><span>User</span><span>Used</span><span>Quota</span><span>Custom quota bytes</span><span>Action</span></div>
        {storage.data?.map((row) => (
          <div key={row.userId} className="table-row">
            <strong>{row.username}</strong>
            <span>{formatBytes(row.storageUsedBytes)}</span>
            <span>{formatBytes(row.storageQuotaBytes)}{row.hasCustomQuota ? ' · custom' : ''}</span>
            <Input value={userQuota[row.userId] ?? ''} onChange={(event) => setUserQuota((current) => ({ ...current, [row.userId]: event.target.value }))} placeholder="Blank resets" />
            <Button onClick={() => setQuota.mutate({ userId: row.userId, quotaBytes: userQuota[row.userId] ? Number(userQuota[row.userId]) : null })}>Apply</Button>
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

  function updateSection(section: keyof Pick<PolicyBundle, 'lifecycle' | 'shareAvailability' | 'userTargetedSharing' | 'passwordExtraction' | 'publicLinks' | 'liveTransfer'>, key: string, value: string) {
    if (!activeDraft) {
      return
    }

    const parsed: boolean | number | string | null =
      value === 'true' ? true : value === 'false' ? false : value === 'null' ? null : Number.isFinite(Number(value)) && value.trim() !== '' ? Number(value) : value
    setDraft({
      ...activeDraft,
      [section]: {
        ...activeDraft[section],
        [key]: parsed,
      },
    })
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
          {(['lifecycle', 'shareAvailability', 'userTargetedSharing', 'passwordExtraction', 'publicLinks', 'liveTransfer'] as const).map((section) => (
            <section key={section} className="policy-section">
              <h3>{section}</h3>
              {Object.entries(activeDraft[section]).map(([key, value]) => (
                <Field key={key} label={key}>
                  <Input value={String(value)} onChange={(event) => updateSection(section, key, event.target.value)} />
                </Field>
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}
