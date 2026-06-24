import { createBrowserRouter, Navigate } from 'react-router';

import { JobMonitorPage } from '../features/admin/pages/JobMonitorPage';
import { AuthCallbackPage } from '../features/auth/pages/AuthCallbackPage';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { CompanyListPage } from '../features/company/pages/CompanyListPage';
import { HomePage } from '../features/home/pages/HomePage';
import { JobPreferencePage } from '../features/job/pages/JobPreferencePage';
import { TechManagerPage } from '../features/keyword/pages/TechManagerPage';
import { MethodologyPage } from '../features/methodology/pages/MethodologyPage';
import { TechCombosPage } from '../features/techs/pages/TechCombosPage';
import { TechRankingPage } from '../features/techs/pages/TechRankingPage';
import { AdminRoute } from './AdminRoute';
import { ProtectedRoute } from './ProtectedRoute';
import { RootLayout } from './RootLayout';

// Routes that are reachable without authentication (parity with the old
// vue-router PUBLIC_ROUTES). The ProtectedRoute / AdminRoute guards enforce the
// rest; LoginPage redirects already-authenticated users home.
export const PUBLIC_PATHS = [
  '/',
  '/login',
  '/auth/callback',
  '/techs',
  '/techs/combos',
  '/methodology',
] as const;

// Full 10-route table (task 10.1) mapping every legacy vue-router path to its
// React page. RootLayout provides the app shell + ScrollManager; the protected
// and admin-only routes nest under their guards; unknown paths fall back to the
// home page so there is never a blank/framework error screen (requirement 1.3).
export const router = createBrowserRouter(
  [
    {
      element: <RootLayout />,
      children: [
        // Public routes
        { path: '/', element: <HomePage /> },
        { path: '/techs', element: <TechRankingPage /> },
        { path: '/techs/combos', element: <TechCombosPage /> },
        { path: '/methodology', element: <MethodologyPage /> },
        { path: '/login', element: <LoginPage /> },
        { path: '/auth/callback', element: <AuthCallbackPage /> },

        // Authenticated routes
        {
          element: <ProtectedRoute />,
          children: [
            { path: '/jobs', element: <JobPreferencePage /> },
            { path: '/companies', element: <CompanyListPage /> },
            { path: '/keywords', element: <TechManagerPage /> },
            // Admin-only (nested below ProtectedRoute so anonymous users go to
            // /login first, then non-admins are sent home)
            {
              element: <AdminRoute />,
              children: [
                { path: '/admin/jobs', element: <JobMonitorPage /> },
              ],
            },
          ],
        },

        // Unknown route -> home (requirement 1.3)
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
