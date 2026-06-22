import { QueryClient } from '@tanstack/react-query';

// Minimal instance for the provider skeleton (task 1.2).
// Defaults (staleTime / retry / error behavior) are configured in task 1.3.
export const queryClient = new QueryClient();
