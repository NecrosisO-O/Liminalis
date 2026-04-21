import { useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../lib/api.ts'

export function PublicLinkPage() {
  const { token } = useParams()

  const publicLinkQuery = useQuery({
    queryKey: ['public-link', token],
    queryFn: () => api.getPublicLink(token ?? ''),
    enabled: Boolean(token),
    retry: false,
  })

  const ticketMutation = useMutation({
    mutationFn: async () => {
      const ticket = await api.issuePublicLinkTicket(token ?? '')
      return api.redeemPublicLinkTicket(ticket.ticketToken)
    },
  })

  return (
    <section className="surface-card auth-card">
      <p className="eyebrow">Public link</p>
      <h2>Direct download</h2>
      <p className="muted">This convenience path does not show metadata before download.</p>

      {publicLinkQuery.data ? (
        <div className="detail-list">
          <div>
            <span>State</span>
            <strong>{publicLinkQuery.data.state}</strong>
          </div>
          <div>
            <span>Remaining downloads</span>
            <strong>{publicLinkQuery.data.remainingDownloadCount}</strong>
          </div>
        </div>
      ) : null}

      <div className="button-row">
        <button className="primary-button" type="button" onClick={() => ticketMutation.mutate()}>
          Start download
        </button>
      </div>

      {ticketMutation.data ? (
        <div className="surface-card compact-card result-card">
          <p className="eyebrow">Delivery ticket redeemed</p>
          <p className="muted">Content kind: {ticketMutation.data.contentKind}</p>
        </div>
      ) : null}
    </section>
  )
}
