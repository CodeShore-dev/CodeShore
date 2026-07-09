import { Suspense } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RouterProvider } from 'react-router';

import { AuthProvider } from '../features/auth/AuthProvider';
import { queryClient } from '../lib/queryClient';
import { router } from './router';

export function Providers() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Suspense fallback={<div aria-busy="true" />}>
          <RouterProvider router={router} />
        </Suspense>
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

