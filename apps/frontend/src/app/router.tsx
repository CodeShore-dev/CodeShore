import { lazy } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';

import { AdminRoute } from './AdminRoute';
import { ProtectedRoute } from './ProtectedRoute';
import { RootLayout } from './RootLayout';
import { RouteErrorBoundary } from './RouteErrorBoundary';

// Lazy-loaded page components for code splitting (task 4.2, requirement 4.3,
// 6.4). Each page is loaded on first navigation, keeping the initial bundle
// small. The <Suspense> boundary is provided by Providers.tsx so a single
// fallback covers the entire router. Structural / guard components
// (RootLayout, ProtectedRoute, AdminRoute) are NOT lazy because they are
// always needed on first render.
const HomePage = lazy(() =>
  import('../features/home/pages/HomePage').then(m => ({ default: m.HomePage })),
);
const TechsPage = lazy(() =>
  import('../features/techs/pages/TechsPage').then(m => ({ default: m.TechsPage })),
);
const MethodologyPage = lazy(() =>
  import('../features/methodology/pages/MethodologyPage').then(m => ({
    default: m.MethodologyPage,
  })),
);
const LoginPage = lazy(() =>
  import('../features/auth/pages/LoginPage').then(m => ({ default: m.LoginPage })),
);
const AuthCallbackPage = lazy(() =>
  import('../features/auth/pages/AuthCallbackPage').then(m => ({
    default: m.AuthCallbackPage,
  })),
);
const JobPreferencePage = lazy(() =>
  import('../features/job/pages/JobPreferencePage').then(m => ({
    default: m.JobPreferencePage,
  })),
);
const CompanyListPage = lazy(() =>
  import('../features/company/pages/CompanyListPage').then(m => ({
    default: m.CompanyListPage,
  })),
);
const TechManagerPage = lazy(() =>
  import('../features/keyword/pages/TechManagerPage').then(m => ({
    default: m.TechManagerPage,
  })),
);
const JobMonitorPage = lazy(() =>
  import('../features/admin/pages/JobMonitorPage').then(m => ({
    default: m.JobMonitorPage,
  })),
);
const AiSuggestionReviewPage = lazy(() =>
  import('../features/ai-suggestion/pages/AiSuggestionReviewPage').then(m => ({
    default: m.AiSuggestionReviewPage,
  })),
);
const NotFoundPage = lazy(() =>
  import('../features/not-found/pages/NotFoundPage').then(m => ({
    default: m.NotFoundPage,
  })),
);

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
// and admin-only routes nest under their guards; unknown paths render
// NotFoundPage so there is never a blank/framework error screen and search
// engines receive a proper 404 UI (requirement 4.3).
// Exported as a plain data structure (not just the built `router`) so a
// router-level test can assert on route nesting/guard placement with
// `matchRoutes` without instantiating the full app (task 2.1).
export const routeConfig: RouteObject[] = [
  {
    element: <RootLayout />,
    // Catches errors from every descendant route, including render-time
    // failures thrown by React.lazy() page chunks (e.g. a stale client
    // requesting a hashed chunk a newer deploy no longer serves). Without
    // this, react-router's data router falls back to its raw dev-mode error
    // screen in production.
    errorElement: <RouteErrorBoundary />,
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

      // Unknown routes -> 404 page (requirement 4.3)
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routeConfig, {
  basename: import.meta.env.BASE_URL,
});
