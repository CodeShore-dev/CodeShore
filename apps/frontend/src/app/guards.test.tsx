import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '@supabase/supabase-js';

// Deterministic env so canEdit does not depend on the real .env allowlist.
vi.mock('../config/env', () => ({
  env: {
    isDev: true,
    baseUrl: '/',
    appVersion: 'test',
    adminEmails: ['admin@codeshore.dev'],
    supabaseUrl: 'http://localhost',
    supabaseAnonKey: 'anon-key',
  },
}));

import { useAuthStore } from '../features/auth/authStore';
import { AdminRoute } from './AdminRoute';
import { ProtectedRoute } from './ProtectedRoute';

const adminUser = { email: 'admin@codeshore.dev' } as User;
const normalUser = { email: 'user@x.com' } as User;

function renderWithGuard(
  guard: React.ReactElement,
  protectedPath: string,
  startAt: string,
) {
  return render(
    <MemoryRouter initialEntries={[startAt]}>
      <Routes>
        <Route element={guard}>
          <Route path={protectedPath} element={<div>protected content</div>} />
        </Route>
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/" element={<div>home page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuthStore.setState({ user: null, isLoading: false, viewAsRegularUser: false });
});

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to /login (req 2.1, 2.2)', () => {
    useAuthStore.setState({ user: null, isLoading: false });
    renderWithGuard(<ProtectedRoute />, '/jobs', '/jobs');
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('renders content for authenticated users', () => {
    useAuthStore.setState({ user: normalUser, isLoading: false });
    renderWithGuard(<ProtectedRoute />, '/jobs', '/jobs');
    expect(screen.getByText('protected content')).toBeInTheDocument();
  });

  it('renders nothing while the session is loading (req 2.5)', () => {
    useAuthStore.setState({ user: null, isLoading: true });
    renderWithGuard(<ProtectedRoute />, '/jobs', '/jobs');
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
    expect(screen.queryByText('login page')).not.toBeInTheDocument();
  });
});

describe('AdminRoute', () => {
  it('redirects unauthenticated users home (req 2.4)', () => {
    useAuthStore.setState({ user: null, isLoading: false, viewAsRegularUser: false });
    renderWithGuard(<AdminRoute />, '/admin/jobs', '/admin/jobs');
    expect(screen.getByText('home page')).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('redirects authenticated non-admins home (req 2.4)', () => {
    useAuthStore.setState({ user: normalUser, isLoading: false, viewAsRegularUser: false });
    renderWithGuard(<AdminRoute />, '/admin/jobs', '/admin/jobs');
    expect(screen.getByText('home page')).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('renders content for allowlisted admins (req 2.4)', () => {
    useAuthStore.setState({ user: adminUser, isLoading: false, viewAsRegularUser: false });
    renderWithGuard(<AdminRoute />, '/admin/jobs', '/admin/jobs');
    expect(screen.getByText('protected content')).toBeInTheDocument();
  });

  it('still admits an admin who has enabled the regular-user preview toggle (req 5.5)', () => {
    useAuthStore.setState({ user: adminUser, isLoading: false, viewAsRegularUser: true });
    renderWithGuard(<AdminRoute />, '/admin/jobs', '/admin/jobs');
    expect(screen.getByText('protected content')).toBeInTheDocument();
    expect(screen.queryByText('home page')).not.toBeInTheDocument();
  });
});
