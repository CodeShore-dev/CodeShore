import { Navigate, Outlet } from 'react-router';

import { useAuthStore, useIsAdmin } from '../features/auth/authStore';

// Restricts admin-only routes to users with the raw admin permission (task
// 2.2, requirement 5.5); non-admins are sent home. Uses useIsAdmin() rather
// than useCanEdit() so access here is unaffected by the admin's
// viewAsRegularUser preview toggle. Nest this BELOW ProtectedRoute in the
// route table so unauthenticated users are sent to /login first.
export function AdminRoute() {
  const isLoading = useAuthStore(state => state.isLoading);
  const isAdmin = useIsAdmin();

  if (isLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}
