import { QueryClient } from '@tanstack/react-query'

/**
 * Model calls can take a few seconds; a short retry with backoff absorbs a
 * transient hiccup without the user noticing, while ApiUnreachableError
 * (backend not running at all) is left to surface immediately rather than
 * retried into a longer silent wait.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  },
})
