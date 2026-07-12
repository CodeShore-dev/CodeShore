import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { useAuthStore } from '../../auth/authStore';

const { fetchWatchlist } = vi.hoisted(() => ({ fetchWatchlist: vi.fn() }));

vi.mock('../service', async importOriginal => {
  const actual = await importOriginal<typeof import('../service')>();
  return { ...actual, fetchWatchlist };
});

import { JobFilterWatchlistPage } from './JobFilterWatchlistPage';

const authedUser = { id: 'u1', email: 'a@b.com' } as never;

const subscriptions = [
  {
    id: 'sub-1',
    label: '技術：React・薪資 60k+',
    lastViewedAt: '2026-07-10T00:00:00.000Z',
    createdAt: '2026-07-01T00:00:00.000Z',
    totalCount: 42,
    newCount: 3,
  },
  {
    id: 'sub-2',
    label: '地點：台北',
    lastViewedAt: '2026-07-12T00:00:00.000Z',
    createdAt: '2026-07-05T00:00:00.000Z',
    totalCount: 10,
    newCount: 0,
  },
];

// Watchlist page (task 4.2, design.md's JobFilterWatchlistPage, requirements
// 2.1-2.3, 7.1): guest-gated route that lists followed filter combinations
// with their counts/last-viewed time, or a guided empty state.
describe('JobFilterWatchlistPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: null, isLoading: false });
  });

  it('guest visit shows the login prompt and renders no subscription data (Req 7.1)', async () => {
    fetchWatchlist.mockResolvedValue(subscriptions);

    renderWithProviders(<JobFilterWatchlistPage />, {
      route: '/jobs/watchlist',
    });

    expect(await screen.findByText('需要登入')).toBeInTheDocument();
    expect(
      screen.queryByText('技術：React・薪資 60k+'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('地點：台北')).not.toBeInTheDocument();

    // Give any pending microtasks a chance to resolve and confirm the guard
    // still holds afterwards -- no subscription content ever leaks in.
    await waitFor(() => {
      expect(
        screen.queryByText('技術：React・薪資 60k+'),
      ).not.toBeInTheDocument();
    });
  });

  it('signed-in user with subscriptions renders each item label/totalCount/newCount/lastViewedAt (Req 2.2)', async () => {
    useAuthStore.setState({ user: authedUser, isLoading: false });
    fetchWatchlist.mockResolvedValue(subscriptions);

    renderWithProviders(<JobFilterWatchlistPage />, {
      route: '/jobs/watchlist',
    });

    expect(await screen.findByText('技術：React・薪資 60k+')).toBeInTheDocument();
    expect(screen.getByText('地點：台北')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('3 個新職缺')).toBeInTheDocument();
    expect(screen.getByText('沒有新職缺')).toBeInTheDocument();
    expect(screen.getAllByText(/上次查看：/)).toHaveLength(2);
  });

  it('signed-in user with an empty watchlist shows the guided empty state (Req 2.3)', async () => {
    useAuthStore.setState({ user: authedUser, isLoading: false });
    fetchWatchlist.mockResolvedValue([]);

    renderWithProviders(<JobFilterWatchlistPage />, {
      route: '/jobs/watchlist',
    });

    expect(await screen.findByText('尚未關注任何篩選組合')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '前往職缺列表' })).toHaveAttribute(
      'href',
      '/jobs',
    );
  });
});
