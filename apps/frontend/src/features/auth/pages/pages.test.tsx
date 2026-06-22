import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Supabase client so AuthCallbackPage does not hit the network.
const getSession = vi.fn();
vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: { getSession: () => getSession() } },
}));

import { useAuthStore } from '../authStore';
import { AuthCallbackPage } from './AuthCallbackPage';
import { LoginPage } from './LoginPage';

beforeEach(() => {
  useAuthStore.setState({ user: null, isLoading: false });
  getSession.mockReset();
});

describe('LoginPage', () => {
  it('shows OAuth sign-in buttons for unauthenticated users (req 2.3)', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('button', { name: /繼續使用 Google/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /繼續使用 GitHub/ }),
    ).toBeInTheDocument();
  });
});

describe('AuthCallbackPage', () => {
  it('shows an error when no session is returned (req 2.6)', async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    render(
      <MemoryRouter>
        <AuthCallbackPage />
      </MemoryRouter>,
    );
    expect(
      await screen.findByText('登入失敗，請再試一次。'),
    ).toBeInTheDocument();
  });
});
