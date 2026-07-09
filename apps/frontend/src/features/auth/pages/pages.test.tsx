import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { consumeReturnUrl } from '../returnUrl';
import { useAuthStore } from '../authStore';
import { AuthCallbackPage } from './AuthCallbackPage';
import { LoginPage } from './LoginPage';

// Mock the Supabase client so AuthCallbackPage does not hit the network.
const getSession = vi.fn();
vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: { getSession: () => getSession() } },
}));

// Mock returnUrl so LoginPage's redirect-destination logic can be controlled
// per test without touching real sessionStorage.
vi.mock('../returnUrl', () => ({
  consumeReturnUrl: vi.fn(),
}));

beforeEach(() => {
  useAuthStore.setState({ user: null, isLoading: false });
  getSession.mockReset();
  vi.mocked(consumeReturnUrl).mockReset();
});

describe('LoginPage', () => {
  it('shows OAuth sign-in buttons for unauthenticated users (req 2.3)', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /繼續使用 Google/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /繼續使用 GitHub/ })).toBeInTheDocument();
  });

  it('sends an already-authenticated user to the stored pending destination (req 4.1)', () => {
    vi.mocked(consumeReturnUrl).mockReturnValue('/jobs?tab=liked');
    useAuthStore.setState({
      user: { id: 'u1', email: 'a@b.com' } as never,
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/jobs" element={<div>Jobs Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Jobs Page')).toBeInTheDocument();
  });

  it('falls back to home when an already-authenticated user has no stored destination (req 4.1)', () => {
    vi.mocked(consumeReturnUrl).mockReturnValue(null);
    useAuthStore.setState({
      user: { id: 'u1', email: 'a@b.com' } as never,
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Home Page')).toBeInTheDocument();
  });
});

describe('AuthCallbackPage', () => {
  it('shows an error when no session is returned (req 2.6)', async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });

    const testQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    render(
      <QueryClientProvider client={testQueryClient}>
        <MemoryRouter>
          <AuthCallbackPage />
        </MemoryRouter>
        ,
      </QueryClientProvider>,
    );
    expect(await screen.findByText('登入失敗，請再試一次。')).toBeInTheDocument();
    expect(consumeReturnUrl).not.toHaveBeenCalled();
  });

  it('navigates to the stored pending destination after a successful callback (req 4.1)', async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: 't' } },
      error: null,
    });
    vi.mocked(consumeReturnUrl).mockReturnValue('/jobs?tab=liked');

    const testQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    render(
      <QueryClientProvider client={testQueryClient}>
        <MemoryRouter initialEntries={['/auth/callback']}>
          <Routes>
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/jobs" element={<div>Jobs Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Jobs Page')).toBeInTheDocument();
  });

  it('falls back to home after a successful callback with no stored destination (req 4.1)', async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: 't' } },
      error: null,
    });
    vi.mocked(consumeReturnUrl).mockReturnValue(null);

    const testQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    render(
      <QueryClientProvider client={testQueryClient}>
        <MemoryRouter initialEntries={['/auth/callback']}>
          <Routes>
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/" element={<div>Home Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Home Page')).toBeInTheDocument();
  });
});

