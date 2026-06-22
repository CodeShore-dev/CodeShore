import { Navigate, Outlet } from 'react-router';

import { useAuthStore, useIsAuthenticated } from '../features/auth/authStore';

// Redirects unauthenticated users to /login (task 2.2, requirements 2.1, 2.2).
// While the initial session check is in flight, render nothing so the guard
// decision waits for initAuth to complete (requirement 2.5).
export function ProtectedRoute() {
  const isLoading = useAuthStore(state => state.isLoading);
  const isAuthenticated = useIsAuthenticated();

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}
