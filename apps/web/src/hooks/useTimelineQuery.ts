import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api.ts'

export function useTimelineQuery() {
  return useQuery({
    queryKey: ['timeline'],
    queryFn: api.getTimeline,
    retry: false,
  })
}
