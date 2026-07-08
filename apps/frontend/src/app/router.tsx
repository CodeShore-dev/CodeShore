import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';

import { JobMonitorPage } from '../features/admin/pages/JobMonitorPage';
import { AiSuggestionReviewPage } from '../features/ai-suggestion/pages/AiSuggestionReviewPage';
import { AuthCallbackPage } from '../features/auth/pages/AuthCallbackPage';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { CompanyListPage } from '../features/company/pages/CompanyListPage';
import { HomePage } from '../features/home/pages/HomePage';
import { JobPreferencePage } from '../features/job/pages/JobPreferencePage';
import { TechManagerPage } from '../features/keyword/pages/TechManagerPage';
import { MethodologyPage } from '../features/methodology/pages/MethodologyPage';
import { TechsPage } from '../features/techs/pages/TechsPage';
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
  '/jobs',
  '/companies',
] as const;

// Full 10-route table (task 10.1) mapping every legacy vue-router path to its
// React page. RootLayout provides the app shell + ScrollManager; the protected
// and admin-only routes nest under their guards; unknown paths fall back to the
// home page so there is never a blank/framework error screen (requirement 1.3).
// Exported as a plain data structure (not just the built `router`) so a
// router-level test can assert on route nesting/guard placement with
// `matchRoutes` without instantiating the full app (task 2.1).
export const routeConfig: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      // Public routes
      { path: '/', element: <HomePage /> },
      { path: '/techs', element: <TechsPage /> },
      {
        path: '/techs/combos',
        element: <Navigate to="/techs?mode=combos" replace />,
      },
      { path: '/methodology', element: <MethodologyPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/auth/callback', element: <AuthCallbackPage /> },
      // /jobs and /companies are public (open to unauthenticated visitors,
      // requirement 1.1-1.4); they keep their existing filtering/search
      // behavior since only their guard placement moved, not the pages
      // themselves.
      { path: '/jobs', element: <JobPreferencePage /> },
      { path: '/companies', element: <CompanyListPage /> },

      // Authenticated routes
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/keywords', element: <TechManagerPage /> },
          // Admin-only (nested below ProtectedRoute so anonymous users go to
          // /login first, then non-admins are sent home)
          {
            element: <AdminRoute />,
            children: [
              { path: '/admin/jobs', element: <JobMonitorPage /> },
              {
                path: '/admin/ai-suggestions',
                element: <AiSuggestionReviewPage />,
              },
            ],
          },
        ],
      },

      // Unknown route -> home (requirement 1.3)
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];

export const router = createBrowserRouter(routeConfig, {
  basename: import.meta.env.BASE_URL,
});
