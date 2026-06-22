import { QueryClient } from '@tanstack/react-query';

// Shared server-state client for the migration (task 1.3).
// Defaults favour parity with the previous on-demand fetching behavior:
// no surprise refetch on window focus, a short stale window, and a single retry.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
