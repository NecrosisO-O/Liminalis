import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api.ts'

export function useBootstrapQuery() {
  return useQuery({
    queryKey: ['bootstrap'],
    queryFn: api.bootstrap,
    retry: false,
  })
}
