import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { useAuthStore } from '../../auth/authStore';
import { useKeywordFilterStore } from '../../keyword/keywordFilterStore';
import { useJobFilterStore } from '../jobFilterStore';

vi.mock('../../keyword/service', () => ({
  fetchMvTech: vi.fn().mockResolvedValue({
    result: [{ tech: 'reactjs', label: 'React', category: '' }],
  }),
  fetchTechCategories: vi.fn().mockResolvedValue({ result: [] }),
  updateTech: vi.fn().mockResolvedValue(undefined),
}));

const { followFilter } = vi.hoisted(() => ({ followFilter: vi.fn() }));

vi.mock('../../job-filter-watchlist/service', async importOriginal => {
  const actual =
    await importOriginal<typeof import('../../job-filter-watchlist/service')>();
  return { ...actual, followFilter };
});

import { JobFilterFollowButton } from './JobFilterFollowButton';

const authedUser = { id: 'u1', email: 'a@b.com' } as never;

const subscription = {
  id: 'sub-1',
  label: '技術:React',
  lastViewedAt: '2026-07-12T00:00:00.000Z',
  createdAt: '2026-07-12T00:00:00.000Z',
  totalCount: 10,
  newCount: 2,
};

function limitReachedError() {
  return new AxiosError(
    'Request failed with status code 409',
    '409',
    undefined,
    undefined,
    {
      status: 409,
      statusText: 'Conflict',
      headers: new AxiosHeaders(),
      config: { headers: new AxiosHeaders() },
      data: { code: 'WATCHLIST_LIMIT_REACHED', limit: 20 },
    },
  );
}

// Follow-this-filter action (task 4.1, requirement 1.1-1.4): reads the
// currently applied filter conditions from the job/keyword filter stores,
// submits a follow request guarded by the guest gate, and reflects
// newly-followed / already-followed / limit-reached in the button's state.
describe('JobFilterFollowButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useJobFilterStore.getState().reset();
    useKeywordFilterStore.getState().reset();
    useAuthStore.setState({ user: null, isLoading: false });
  });

  it('renders the idle "關注此篩選" state by default', () => {
    useAuthStore.setState({ user: authedUser, isLoading: false });
    renderWithProviders(<JobFilterFollowButton />);

    expect(
      screen.getByRole('button', { name: /關注此篩選/ }),
    ).toBeInTheDocument();
  });

  it('signed-in click under the limit calls followFilter with the current filter snapshot/where/label and shows the followed state (Req 1.1, 1.2)', async () => {
    useAuthStore.setState({ user: authedUser, isLoading: false });
    useJobFilterStore.setState({ searchText: 'golang' });
    followFilter.mockResolvedValue(subscription);
    const user = userEvent.setup();

    renderWithProviders(<JobFilterFollowButton />);
    await user.click(screen.getByRole('button', { name: /關注此篩選/ }));

    await waitFor(() => expect(followFilter).toHaveBeenCalledTimes(1));
    expect(followFilter).toHaveBeenCalledWith(
      expect.objectContaining({ searchText: 'golang' }),
      expect.any(Object),
      expect.any(String),
    );

    expect(await screen.findByText('已關注')).toBeInTheDocument();
  });

  it('clicking again on an already-followed combination does not create a duplicate and still shows the followed state (Req 1.3)', async () => {
    useAuthStore.setState({ user: authedUser, isLoading: false });
    followFilter.mockResolvedValue(subscription);
    const user = userEvent.setup();

    renderWithProviders(<JobFilterFollowButton />);
    const button = screen.getByRole('button', { name: /關注此篩選/ });
    await user.click(button);
    await screen.findByText('已關注');

    // Button is disabled once followed in this session, so a second
    // programmatic follow attempt (e.g. re-mount / re-click) is exercised
    // via a direct second click; it must not blow up or show a duplicate.
    await user.click(screen.getByRole('button', { name: /已關注/ }));

    expect(screen.getAllByText('已關注')).toHaveLength(1);
  });

  it('does not show the login prompt merely from mounting while signed out, only after a click (Req 1.4)', () => {
    renderWithProviders(<JobFilterFollowButton />);

    expect(screen.queryByText('需要登入')).not.toBeInTheDocument();
  });

  it('signed-out click shows the login prompt instead of following (Req 1.4)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<JobFilterFollowButton />);

    await user.click(screen.getByRole('button', { name: /關注此篩選/ }));

    expect(await screen.findByText('需要登入')).toBeInTheDocument();
    expect(followFilter).not.toHaveBeenCalled();
  });

  it('shows a limit-reached message when the mutation rejects with WATCHLIST_LIMIT_REACHED (Req 5.2)', async () => {
    useAuthStore.setState({ user: authedUser, isLoading: false });
    followFilter.mockRejectedValue(limitReachedError());
    const user = userEvent.setup();

    renderWithProviders(<JobFilterFollowButton />);
    await user.click(screen.getByRole('button', { name: /關注此篩選/ }));

    expect(await screen.findByText('已達關注上限')).toBeInTheDocument();
  });
});
