import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api.ts'

export function useHistoryQuery() {
  return useQuery({
    queryKey: ['history'],
    queryFn: api.getHistory,
    retry: false,
  })
}
