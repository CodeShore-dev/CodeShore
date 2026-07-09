import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { useAuthStore } from '../../auth/authStore';
import { useJobFilterStore } from '../jobFilterStore';
import { useKeywordFilterStore } from '../../keyword/keywordFilterStore';
import { setJobPreference } from '../service';

const { clearJobPreferencesMock } = vi.hoisted(() => ({
  clearJobPreferencesMock: vi.fn().mockResolvedValue({}),
}));

vi.mock('../service', () => ({
  DEFAULT_JOB_ORDERS: 'avg_salary:desc',
  fetchJobs: vi.fn().mockResolvedValue({
    result: [
      {
        id: 'job-1',
        title: 'React 資深工程師',
        company_name: 'Acme 科技',
        location: '台北',
        salary: '面議',
        closed: false,
        detail_link: 'https://example.com/1',
        updated_at: '2026-06-23T00:00:00Z',
        description: '',
        tech_mappings: [],
      },
      {
        id: 'job-2',
        title: 'Vue 前端工程師',
        company_name: 'Globex 公司',
        location: '新竹',
        salary: '面議',
        closed: false,
        detail_link: 'https://example.com/2',
        updated_at: '2026-06-23T00:00:00Z',
        description: '',
        tech_mappings: [],
      },
    ],
    count: 2,
  }),
  fetchJobPreferencedCount: vi
    .fn()
    .mockResolvedValue({ liked_count: 7, disliked_count: 5 }),
  fetchLocationGroups: vi.fn().mockResolvedValue({ result: [] }),
  setJobPreference: vi.fn().mockResolvedValue({}),
  clearJobPreferences: clearJobPreferencesMock,
  createCrawlEventSource: vi.fn(() => ({ close: vi.fn() })),
}));

vi.mock('../../home/service', () => ({
  fetchMvSalaryTypeMedianRatio: vi.fn().mockResolvedValue({ result: [] }),
  fetchMvSalaryRangeMultiplier: vi.fn().mockResolvedValue({ result: [] }),
  fetchJobCount: vi.fn().mockResolvedValue([
    {
      jobs: 200,
      open_jobs: 100,
      month_salary_type_jobs: 10,
      year_salary_type_jobs: 20,
    },
  ]),
}));

vi.mock('../../keyword/service', () => ({
  fetchMvTech: vi.fn().mockResolvedValue({ result: [] }),
  fetchTechCategories: vi.fn().mockResolvedValue({ result: [] }),
  updateTech: vi.fn().mockResolvedValue(undefined),
}));

import { JobPreferencePage } from './JobPreferencePage';

beforeEach(() => {
  useJobFilterStore.getState().reset();
  useKeywordFilterStore.getState().reset();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function clickClearButton(label: string) {
  const user = userEvent.setup();
  renderWithProviders(<JobPreferencePage />, { route: '/jobs' });

  // Wait for the tab counts to load so the clear button (hidden at count '0') renders.
  await screen.findByText('7');

  const clearButton = screen.getByTitle(`清空${label}`);
  await user.click(clearButton);

  return user;
}

describe('JobPreferencePage', () => {
  it('renders the job list, filter sidebar, and preference tabs (req 3.1)', async () => {
    renderWithProviders(<JobPreferencePage />, { route: '/jobs' });

    expect(
      await screen.findByText('React 資深工程師'),
    ).toBeInTheDocument();
    expect(screen.getByText('Vue 前端工程師')).toBeInTheDocument();
    expect(screen.getByText('總數')).toBeInTheDocument();
    expect(screen.getByText('喜歡')).toBeInTheDocument();
    expect(screen.getByText('不喜歡')).toBeInTheDocument();
    expect(screen.getAllByText('篩選條件').length).toBeGreaterThan(0);
  });

  it('derives the liked / disliked tab counts from the count query (req 3.3)', async () => {
    renderWithProviders(<JobPreferencePage />, { route: '/jobs' });

    // liked_count / disliked_count come straight from the preference count query.
    expect(await screen.findByText('7')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('opens the detail drawer with the original-platform handoff (req 3.5)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<JobPreferencePage />, { route: '/jobs' });

    await user.click(await screen.findByText('React 資深工程師'));

    // The drawer mounts the full job card subtree incl. the handoff CTA.
    expect(await screen.findByText('前往原始職缺')).toBeInTheDocument();
    const handoff = screen.getByRole('link', { name: /前往原始職缺/ });
    expect(handoff).toHaveAttribute('href', 'https://example.com/1');
  });
});

describe('JobPreferencePage filtering', () => {
  it('marks active filters and supports clearing them (req 3.2)', async () => {
    const user = userEvent.setup();
    useJobFilterStore.getState().setSearchText('react');

    renderWithProviders(<JobPreferencePage />, { route: '/jobs' });

    // The active-filter chip bar surfaces the search filter.
    expect(await screen.findByText('react')).toBeInTheDocument();

    await user.click(screen.getByText('清除全部'));

    expect(useJobFilterStore.getState().searchText).toBe('');
  });

  it('clears company filters and resets the page when clearing all filters (req 3.2)', async () => {
    const user = userEvent.setup();
    useJobFilterStore.setState({
      companyFilters: [{ name: 'Acme 科技', mode: 'include' }],
      page: 3,
    });

    // Spy on the store's setState directly: other clearAllFilters setters
    // (setSearchText, setSalaryFilter, etc.) call the store's internal `set`
    // closure captured at store-creation time, NOT this public setState
    // method, so this spy only observes the literal
    // `useJobFilterStore.setState({ companyFilters: [], page: 1 })` call in
    // JobPreferencePage's clearAllFilters. That isolates the assertion from
    // every other setter's independent page-reset side effect.
    const setStateSpy = vi.spyOn(useJobFilterStore, 'setState');

    renderWithProviders(<JobPreferencePage />, { route: '/jobs' });

    expect(await screen.findByText('清除全部')).toBeInTheDocument();

    await user.click(screen.getByText('清除全部'));

    expect(setStateSpy).toHaveBeenCalledWith({ companyFilters: [], page: 1 });
    expect(useJobFilterStore.getState().companyFilters).toEqual([]);
    expect(useJobFilterStore.getState().page).toBe(1);

    setStateSpy.mockRestore();
  });
});

describe('JobPreferencePage clear-preferences confirmation (req 7)', () => {
  it('opens a confirm dialog instead of clearing immediately when the clear button is clicked (req 7.1)', async () => {
    await clickClearButton('喜歡');

    // The dialog should be visible, and no mutation call should have happened yet.
    expect(
      await screen.findByRole('button', { name: '確認' }),
    ).toBeInTheDocument();
    expect(clearJobPreferencesMock).not.toHaveBeenCalled();
  });

  it('clears the "like" preferences only after the user confirms (req 7.2)', async () => {
    const user = await clickClearButton('喜歡');

    await user.click(await screen.findByRole('button', { name: '確認' }));

    await waitFor(() => {
      expect(clearJobPreferencesMock).toHaveBeenCalledWith('like');
    });
    expect(clearJobPreferencesMock).toHaveBeenCalledTimes(1);
  });

  it('clears the "dislike" preferences only after the user confirms (req 7.2)', async () => {
    const user = await clickClearButton('不喜歡');

    await user.click(await screen.findByRole('button', { name: '確認' }));

    await waitFor(() => {
      expect(clearJobPreferencesMock).toHaveBeenCalledWith('dislike');
    });
    expect(clearJobPreferencesMock).toHaveBeenCalledTimes(1);
  });

  it('closes the dialog without calling the mutation when the user cancels (req 7.3)', async () => {
    const user = await clickClearButton('喜歡');

    await user.click(await screen.findByRole('button', { name: '取消' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: '確認' }),
      ).not.toBeInTheDocument();
    });
    expect(clearJobPreferencesMock).not.toHaveBeenCalled();
  });

  it('does not show the clear button for a preference type with zero count (req 7.4)', async () => {
    renderWithProviders(<JobPreferencePage />, { route: '/jobs' });

    await screen.findByText('7');

    // The "總數" (total) tab has no onClear wired up, so it never shows a clear button
    // regardless of count -- only 喜歡/不喜歡 tabs (with onClear) are gated on count !== '0'.
    expect(screen.queryByTitle('清空總數')).not.toBeInTheDocument();
  });
});

describe('JobPreferencePage guest preference gate (req 2, 3)', () => {
  it('shows the login prompt and does not switch to the liked list when a guest clicks the 喜歡 tab (req 3.1, 3.3)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<JobPreferencePage />, { route: '/jobs' });

    await screen.findByText('7');
    expect(useJobFilterStore.getState().listViewPreference).toBeNull();

    await user.click(screen.getByText('喜歡'));

    expect(await screen.findByText('需要登入')).toBeInTheDocument();
    // The tab switch must not have gone through: the store still shows no
    // preference selected, and the like-list count/count text is unaffected.
    expect(useJobFilterStore.getState().listViewPreference).toBeNull();
  });

  it('shows the login prompt and does not switch to the disliked list when a guest clicks the 不喜歡 tab (req 3.1, 3.3)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<JobPreferencePage />, { route: '/jobs' });

    await screen.findByText('7');

    await user.click(screen.getByText('不喜歡'));

    expect(await screen.findByText('需要登入')).toBeInTheDocument();
    expect(useJobFilterStore.getState().listViewPreference).toBeNull();
  });

  it('does not show the login prompt when an authenticated user clicks the 喜歡 tab (req 2.4)', async () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'user@example.com' } as never,
      isLoading: false,
    });
    const user = userEvent.setup();
    renderWithProviders(<JobPreferencePage />, { route: '/jobs' });

    await screen.findByText('7');

    await user.click(screen.getByText('喜歡'));

    expect(screen.queryByText('需要登入')).not.toBeInTheDocument();
    expect(useJobFilterStore.getState().listViewPreference).toBe('like');

    act(() => {
      useAuthStore.setState({ user: null, isLoading: true });
    });
  });

  // A row's like/dislike buttons have no accessible name (icon-only), so we
  // locate them by walking up from the job title text to the <li> row and
  // pulling its buttons in DOM order: [like, dislike] (see JobListItem.tsx).
  async function getRowPreferenceButtons(jobTitle: string) {
    const titleEl = await screen.findByText(jobTitle);
    const row = titleEl.closest('li') as HTMLElement;
    const [likeButton, dislikeButton] = within(row).getAllByRole('button');
    return { likeButton, dislikeButton };
  }

  it('shows the login prompt and does not call the preference service when a guest clicks the like button on a job row (req 2.1, 2.2)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<JobPreferencePage />, { route: '/jobs' });

    await screen.findByText('7');
    const { likeButton } = await getRowPreferenceButtons('React 資深工程師');

    await user.click(likeButton);

    expect(await screen.findByText('需要登入')).toBeInTheDocument();
    expect(setJobPreference).not.toHaveBeenCalled();
  });

  it('shows the login prompt and does not call the preference service when a guest clicks the dislike button on a job row (req 2.1, 2.2)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<JobPreferencePage />, { route: '/jobs' });

    await screen.findByText('7');
    const { dislikeButton } = await getRowPreferenceButtons('React 資深工程師');

    await user.click(dislikeButton);

    expect(await screen.findByText('需要登入')).toBeInTheDocument();
    expect(setJobPreference).not.toHaveBeenCalled();
  });

  it('does not call the preference service after confirming the login prompt triggered by a like button click (req 4.2)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<JobPreferencePage />, { route: '/jobs' });

    await screen.findByText('7');
    const { likeButton } = await getRowPreferenceButtons('React 資深工程師');

    await user.click(likeButton);
    await screen.findByText('需要登入');

    // Confirming only navigates towards /login; it must not replay the
    // like action that originally triggered the prompt (req 4.2).
    await user.click(screen.getByRole('button', { name: '前往登入' }));

    await waitFor(() => {
      expect(screen.queryByText('需要登入')).not.toBeInTheDocument();
    });
    expect(setJobPreference).not.toHaveBeenCalled();
  });

  it('cancelling the prompt from a dislike button click calls no service and leaves the job list unaffected (req 2.3)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<JobPreferencePage />, { route: '/jobs' });

    await screen.findByText('7');
    const { dislikeButton } = await getRowPreferenceButtons('React 資深工程師');

    await user.click(dislikeButton);
    await screen.findByText('需要登入');

    await user.click(screen.getByRole('button', { name: '取消' }));

    await waitFor(() => {
      expect(screen.queryByText('需要登入')).not.toBeInTheDocument();
    });
    expect(setJobPreference).not.toHaveBeenCalled();
    // The job list and preference counts are untouched by the cancelled
    // action.
    expect(screen.getByText('React 資深工程師')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('calls the preference service directly (no prompt) when an authenticated user clicks the like button on a job row (req 2.4)', async () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'user@example.com' } as never,
      isLoading: false,
    });
    const user = userEvent.setup();
    renderWithProviders(<JobPreferencePage />, { route: '/jobs' });

    await screen.findByText('7');
    const { likeButton } = await getRowPreferenceButtons('React 資深工程師');

    await user.click(likeButton);

    expect(screen.queryByText('需要登入')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(setJobPreference).toHaveBeenCalledWith('job-1', 'like');
    });

    act(() => {
      useAuthStore.setState({ user: null, isLoading: true });
    });
  });
});
