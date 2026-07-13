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

// Req 6.5, 6.7: the plain-text email + standalone logout button, shown only
// when signed in, is replaced by the UserMenu dropdown; the signed-out
// /login link stays untouched. This was a behavioral change to an
// already-shipped component, implemented under the Feature Flag Protocol --
// RED was captured with a local, OFF-by-default flag gating the swap (the
// old span/button still rendered while these UserMenu-shaped assertions
// failed); GREEN was confirmed with the flag on, then the flag was removed
// once proven (these tests now cover the unconditional swap).
describe('AppNavBar account area', () => {
  it('renders the UserMenu trigger instead of the plain-text email/logout pair when signed in', () => {
    useAuthStore.setState({ user: normalUser, viewAsRegularUser: false });
    renderNavBar();

    // UserMenu's trigger button exposes the email as its accessible name
    // (aria-label), not as visible text content -- so this only passes once
    // <UserMenu /> replaces the old <span>{user.email}</span>.
    expect(
      screen.getByRole('button', { name: normalUser.email }),
    ).toBeInTheDocument();

    // The old plain-text email span is gone (its text content is no longer
    // rendered anywhere before the menu is opened).
    expect(screen.queryByText(normalUser.email)).not.toBeInTheDocument();

    // The old always-visible standalone logout button is gone -- UserMenu's
    // own logout item only renders once the dropdown is expanded.
    expect(
      screen.queryByRole('button', { name: '登出' }),
    ).not.toBeInTheDocument();
  });

  it('leaves the signed-out /login link and AdminViewToggle placement untouched', () => {
    renderNavBar();

    expect(screen.getByRole('link', { name: '登入' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(
      screen.queryByRole('button', { name: normalUser.email }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('管理視角')).not.toBeInTheDocument();
  });
});
