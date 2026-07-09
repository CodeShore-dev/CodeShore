import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '@supabase/supabase-js';

// Deterministic env so useIsAdmin does not depend on the real .env
// allowlist (same pattern as authStore.test.tsx / guards.test.tsx).
vi.mock('../../../config/env', () => ({
  env: {
    isDev: true,
    baseUrl: '/',
    appVersion: 'test',
    adminEmails: ['admin@codeshore.dev'],
    supabaseUrl: 'http://localhost',
    supabaseAnonKey: 'anon-key',
  },
}));

import { useAuthStore } from '../authStore';
import { AdminViewToggle } from './AdminViewToggle';

const adminUser = { email: 'admin@codeshore.dev' } as User;
const normalUser = { email: 'user@x.com' } as User;

// Req 5.1-5.3: standalone control, not yet mounted anywhere (task 7).
describe('AdminViewToggle', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAuthStore.setState({
      user: null,
      isLoading: false,
      viewAsRegularUser: false,
    });
  });

  it('renders nothing for a non-admin user', () => {
    useAuthStore.setState({ user: normalUser, viewAsRegularUser: false });
    const { container } = render(<AdminViewToggle />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a logged-out visitor', () => {
    useAuthStore.setState({ user: null, viewAsRegularUser: false });
    const { container } = render(<AdminViewToggle />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the admin mode and toggle button for an admin', () => {
    useAuthStore.setState({ user: adminUser, viewAsRegularUser: false });
    render(<AdminViewToggle />);

    expect(screen.getByText('管理視角')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '切換為一般使用者視角' }),
    ).toBeInTheDocument();
  });

  it('shows the regular-user mode label when viewAsRegularUser is already on', () => {
    useAuthStore.setState({ user: adminUser, viewAsRegularUser: true });
    render(<AdminViewToggle />);

    expect(screen.getByText('一般使用者視角')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '切換為管理視角' }),
    ).toBeInTheDocument();
  });

  it('updates the label and button after clicking the toggle', async () => {
    useAuthStore.setState({ user: adminUser, viewAsRegularUser: false });
    const user = userEvent.setup();
    render(<AdminViewToggle />);

    await user.click(
      screen.getByRole('button', { name: '切換為一般使用者視角' }),
    );

    expect(useAuthStore.getState().viewAsRegularUser).toBe(true);
    expect(screen.getByText('一般使用者視角')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '切換為管理視角' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '切換為管理視角' }));

    expect(useAuthStore.getState().viewAsRegularUser).toBe(false);
    expect(screen.getByText('管理視角')).toBeInTheDocument();
  });
});
