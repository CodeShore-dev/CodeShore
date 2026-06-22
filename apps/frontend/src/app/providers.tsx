import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';

import { queryClient } from '../lib/queryClient';
import { router } from './router';

// Composition root for global providers (task 1.2).
// AuthProvider is added in task 2.1.
export function Providers() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
