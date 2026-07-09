import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '@supabase/supabase-js';

// Deterministic env so useIsAdmin does not depend on the real .env
// allowlist (same pattern as useNavLinks.test.tsx / AdminViewToggle.test.tsx).
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
import { AppNavBar } from './AppNavBar';

const adminUser = { email: 'admin@codeshore.dev' } as User;
const normalUser = { email: 'user@x.com' } as User;

function renderNavBar() {
  return render(
    <MemoryRouter>
      <AppNavBar />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  useAuthStore.setState({
    user: null,
    isLoading: false,
    viewAsRegularUser: false,
  });
});

// Req 5.1, 5.3: the admin view toggle must be reachable from every page's
// navigation bar, next to the signed-in user display, but only for admins.
describe('AppNavBar', () => {
  it('shows the admin view toggle in the nav bar for an admin', () => {
    useAuthStore.setState({ user: adminUser, viewAsRegularUser: false });
    renderNavBar();

    expect(screen.getByText('管理視角')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '切換為一般使用者視角' }),
    ).toBeInTheDocument();
  });

  it('does not show the admin view toggle for a non-admin user', () => {
    useAuthStore.setState({ user: normalUser, viewAsRegularUser: false });
    renderNavBar();

    expect(screen.queryByText('管理視角')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '切換為一般使用者視角' }),
    ).not.toBeInTheDocument();
  });

  it('does not show the admin view toggle for a logged-out visitor', () => {
    renderNavBar();

    expect(screen.queryByText('管理視角')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '切換為一般使用者視角' }),
    ).not.toBeInTheDocument();
  });
});
