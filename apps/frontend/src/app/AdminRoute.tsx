import { Navigate, Outlet } from 'react-router';

import { useAuthStore, useCanEdit } from '../features/auth/authStore';

// Restricts admin-only routes to users with edit permission (task 2.2,
// requirement 2.4); non-admins are sent home. Nest this BELOW ProtectedRoute
// in the route table so unauthenticated users are sent to /login first.
export function AdminRoute() {
  const isLoading = useAuthStore(state => state.isLoading);
  const canEdit = useCanEdit();

  if (isLoading) return null;
  if (!canEdit) return <Navigate to="/" replace />;
  return <Outlet />;
}
