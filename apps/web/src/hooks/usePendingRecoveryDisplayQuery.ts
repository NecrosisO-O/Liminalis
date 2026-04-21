import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api.ts'

export function usePendingRecoveryDisplayQuery(enabled: boolean) {
  return useQuery({
    queryKey: ['recovery', 'pending-display'],
    queryFn: api.pendingRecoveryDisplay,
    retry: false,
    enabled,
  })
}
