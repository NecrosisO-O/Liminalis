import { useQuery } from '@tanstack/react-query'

export function useAdminQuery<T>(queryKey: Array<string>, queryFn: () => Promise<T>) {
  return useQuery({
    queryKey,
    queryFn,
    retry: false,
  })
}
