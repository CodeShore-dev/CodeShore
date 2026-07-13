import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocation } from 'react-router';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { useAuthStore } from '../../auth/authStore';

const { fetchWatchlist, unfollowFilter, markWatchlistViewed } = vi.hoisted(
  () => ({
    fetchWatchlist: vi.fn(),
    unfollowFilter: vi.fn(),
    markWatchlistViewed: vi.fn(),
  }),
);

vi.mock('../service', async importOriginal => {
  const actual = await importOriginal<typeof import('../service')>();
  return { ...actual, fetchWatchlist, unfollowFilter, markWatchlistViewed };
});

import { JobFilterWatchlistPage } from './JobFilterWatchlistPage';

const authedUser = { id: 'u1', email: 'a@b.com' } as never;

const emptySnapshot = {
  searchText: '',
  companyFilters: [],
  salaryFilter: 'none' as const,
  salaryAmount: { type: '' as const, amount: null },
  selectedLocations: [],
  selectedTags: [],
  excludedTags: [],
  techOperator: 'and' as const,
};

const subscriptions = [
  {
    id: 'sub-1',
    label: '技術：React・薪資 60k+',
    filterSnapshot: {
      searchText: 'backend',
      companyFilters: [{ name: 'A公司', mode: 'exclude' as const }],
      salaryFilter: 'excluding' as const,
      salaryAmount: { type: 'month' as const, amount: 600_000 },
      selectedLocations: ['taipei'],
      selectedTags: ['react', 'typescript'],
      excludedTags: [],
      techOperator: 'and' as const,
    },
    lastViewedAt: '2026-07-10T00:00:00.000Z',
    createdAt: '2026-07-01T00:00:00.000Z',
    totalCount: 42,
    newCount: 3,
  },
  {
    id: 'sub-2',
    label: '地點：台北',
    filterSnapshot: emptySnapshot,
    lastViewedAt: '2026-07-12T00:00:00.000Z',
    createdAt: '2026-07-05T00:00:00.000Z',
    totalCount: 10,
    newCount: 0,
  },
];

let lastLocation: { pathname: string; search: string } | null = null;

function LocationSpy() {
  const location = useLocation();
  lastLocation = { pathname: location.pathname, search: location.search };
  return null;
}

// Watchlist page (tasks 4.2/4.3, design.md's JobFilterWatchlistPage,
// requirements 2.1-2.3, 3.2, 3.3, 4.1, 7.1): guest-gated route that lists
// followed filter combinations with their counts/last-viewed time, or a
// guided empty state, and wires the real unfollow/view actions.
describe('JobFilterWatchlistPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: null, isLoading: false });
    lastLocation = null;
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

  it('clicking 取消關注 unfollows the subscription and it disappears from the list once refetched (Req 4.1)', async () => {
    useAuthStore.setState({ user: authedUser, isLoading: false });
    fetchWatchlist
      .mockResolvedValueOnce(subscriptions)
      .mockResolvedValueOnce([subscriptions[1]]);
    unfollowFilter.mockResolvedValue(undefined);

    renderWithProviders(<JobFilterWatchlistPage />, {
      route: '/jobs/watchlist',
    });

    await screen.findByText('技術：React・薪資 60k+');
    const unfollowButtons = screen.getAllByRole('button', {
      name: '取消關注',
    });
    await userEvent.click(unfollowButtons[0]);

    expect(unfollowFilter).toHaveBeenCalledWith('sub-1');
    await waitFor(() => {
      expect(
        screen.queryByText('技術：React・薪資 60k+'),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText('地點：台北')).toBeInTheDocument();
  });

  it('clicking a subscription marks it viewed then navigates to /jobs with the reconstructed filter query string (Req 3.2, 3.3)', async () => {
    useAuthStore.setState({ user: authedUser, isLoading: false });
    fetchWatchlist.mockResolvedValue(subscriptions);
    markWatchlistViewed.mockResolvedValue({
      ...subscriptions[0],
      lastViewedAt: '2026-07-13T00:00:00.000Z',
      newCount: 0,
    });

    renderWithProviders(
      <>
        <JobFilterWatchlistPage />
        <LocationSpy />
      </>,
      { route: '/jobs/watchlist' },
    );

    const viewTrigger = await screen.findByText('技術：React・薪資 60k+');
    await userEvent.click(viewTrigger);

    expect(markWatchlistViewed).toHaveBeenCalledWith('sub-1');
    await waitFor(() => {
      expect(lastLocation?.pathname).toBe('/jobs');
    });
    const params = new URLSearchParams(lastLocation?.search);
    expect(params.get('tags')).toBe('react,typescript');
    expect(params.get('salary')).toBe('excluding');
    expect(params.get('salaryType')).toBe('month');
    expect(params.get('salaryAmt')).toBe('60');
    expect(params.get('search')).toBe('backend');
    expect(params.get('locations')).toBe('taipei');
    expect(params.get('notCompanies')).toBe('A公司');
  });

  it('does not navigate when markViewed fails (Req 3.2 only updates after a confirmed view)', async () => {
    useAuthStore.setState({ user: authedUser, isLoading: false });
    fetchWatchlist.mockResolvedValue(subscriptions);
    markWatchlistViewed.mockRejectedValue(new Error('not found'));

    renderWithProviders(
      <>
        <JobFilterWatchlistPage />
        <LocationSpy />
      </>,
      { route: '/jobs/watchlist' },
    );

    const viewTrigger = await screen.findByText('技術：React・薪資 60k+');
    await userEvent.click(viewTrigger);

    await waitFor(() => {
      expect(markWatchlistViewed).toHaveBeenCalledWith('sub-1');
    });
    expect(lastLocation?.pathname).toBe('/jobs/watchlist');
  });
});
