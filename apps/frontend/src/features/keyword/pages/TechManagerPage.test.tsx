import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const { useTechAdminQuery, useRefreshCatalogMutation, useCreateTechMutation } =
  vi.hoisted(() => ({
    useTechAdminQuery: vi.fn(),
    useRefreshCatalogMutation: vi.fn(),
    useCreateTechMutation: vi.fn(),
  }));

vi.mock('../queries', () => ({ useTechAdminQuery }));
vi.mock('../mutations', () => ({
  useRefreshCatalogMutation,
  useCreateTechMutation,
  useBulkDeleteKeywordItemsMutation: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

import { useAuthStore } from '../../auth/authStore';
import { TechManagerPage } from './TechManagerPage';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TechManagerPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// TechManagerPage (task 5.2, requirement 7.5): proves the previously-dead
// `const [, setShowCreateModal] = useState(false)` now drives a real create
// modal, reachable both from a persistent header button and from the
// existing empty-state "建立第一個技術" button.
describe('TechManagerPage — create-modal wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: { email: 'admin@codeshore.dev' } as never,
      isLoading: false,
    });
    useRefreshCatalogMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    useCreateTechMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  it('shows a persistent "新增技術" button that opens the create modal', async () => {
    useTechAdminQuery.mockReturnValue({
      techs: [],
      totalCount: 0,
      totalPages: 1,
      loading: false,
    });
    const user = userEvent.setup();
    renderPage();

    expect(
      screen.queryByRole('heading', { name: '建立技術' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /新增技術/ }));

    expect(
      screen.getByRole('heading', { name: '建立技術' }),
    ).toBeInTheDocument();
  });

  it('the empty-state "建立第一個技術" button also opens the create modal', async () => {
    useTechAdminQuery.mockReturnValue({
      techs: [],
      totalCount: 0,
      totalPages: 1,
      loading: false,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole('button', { name: '建立第一個技術' }),
    );

    expect(
      screen.getByRole('heading', { name: '建立技術' }),
    ).toBeInTheDocument();
  });
});
