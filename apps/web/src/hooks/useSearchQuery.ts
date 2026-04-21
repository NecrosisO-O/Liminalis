import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api.ts'

export function useSearchQuery(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => api.search(query),
    retry: false,
    enabled: query.trim() !== '',
  })
}
