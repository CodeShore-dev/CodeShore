import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { useAuthStore } from '../../auth/authStore';
import { useGuestPreferenceGate } from '../hooks/useGuestPreferenceGate';
import { DEFAULT_JOB_ORDERS, useJobsQuery } from '../queries';
import { setJobPreference } from '../service';
import { JobList } from './JobList';

// A tiny fake backend: marked jobs leave the unmarked list, so the list
// reflects the write even after the mutation's settle-time refetch.
const { marked, makeJob } = vi.hoisted(() => ({
  marked: new Set<string>(),
  makeJob: (id: string, title: string) => ({
    id,
    title,
    company_name: 'Acme 科技',
    location: '台北',
    salary: '面議',
    closed: false,
    detail_link: `https://example.com/${id}`,
    updated_at: '2026-06-23T00:00:00Z',
    description: '',
    tech_mappings: [],
    keyword_groups: [],
  }),
}));

vi.mock('../service', () => ({
  DEFAULT_JOB_ORDERS: 'avg_salary:desc',
  fetchJobs: vi.fn(async () => {
    const all = [makeJob('job-1', 'React 資深工程師'), makeJob('job-2', 'Vue 前端工程師')].filter(
      job => !marked.has(job.id),
    );
    return { result: all, count: all.length };
  }),
  fetchJobPreferencedCount: vi.fn().mockResolvedValue({ liked_count: 0, disliked_count: 0 }),
  fetchPreferenceReasons: vi.fn().mockResolvedValue([{ reason: '未分類', job_count: 0 }]),
  deletePreferenceReason: vi.fn().mockResolvedValue({}),
  clearJobPreferences: vi.fn().mockResolvedValue({}),
  fetchLocationGroups: vi.fn().mockResolvedValue({ result: [] }),
  setJobPreference: vi.fn(async (id: string) => {
    marked.add(id);
    return {};
  }),
  createCrawlEventSource: vi.fn(() => ({ close: vi.fn() })),
}));

vi.mock('../../keyword/service', () => ({
  fetchMvTech: vi.fn().mockResolvedValue({ result: [] }),
}));

// Page-like harness: real jobs query, real guest gate, local drawer
// selection, so the test covers the whole marking path around JobList.
function Harness() {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const { promptOpen, requestPreference } = useGuestPreferenceGate();
  const query = useJobsQuery({
    preference: null,
    page: 1,
    where: {},
    orders: DEFAULT_JOB_ORDERS,
  });
  return (
    <>
      <span data-testid="selected">{selectedJobId ?? 'none'}</span>
      {promptOpen && <p>需要登入</p>}
      <JobList
        jobs={query.data?.result ?? []}
        count={query.data?.count ?? 0}
        page={1}
        loading={query.isLoading}
        fetching={query.isFetching}
        listViewPreference={null}
        selectedJobId={selectedJobId}
        hasActiveFilters={false}
        onSelectJob={setSelectedJobId}
        onPageChange={() => undefined}
        onClearAllFilters={() => undefined}
        onGuardPreference={requestPreference}
      />
    </>
  );
}

function signIn() {
  useAuthStore.setState({
    user: { id: 'u1', email: 'user@example.com' } as never,
    isLoading: false,
  });
}

async function rowLikeButton(title: string) {
  const row = (await screen.findByText(title)).closest('li') as HTMLElement;
  return within(row).getAllByRole('button')[0];
}

async function openDrawer(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(await screen.findByText(title));
  await screen.findByText('● 職缺');
}

// The drawer's like button: the "favorite" icon button outside any list row
// (the swipe hint also shows that icon, but not inside a button).
function drawerLikeButton() {
  const button = screen
    .getAllByText('favorite')
    .map(el => el.closest('button'))
    .find(el => el !== null && el.closest('li') === null);
  return button as HTMLElement;
}

beforeEach(() => {
  marked.clear();
  localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
  act(() => {
    useAuthStore.setState({ user: null, isLoading: true });
  });
});

describe('JobList marking goes through the reason dialog (task 5.1)', () => {
  it('opens the dialog from a list button without writing yet (2.1)', async () => {
    signIn();
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(await rowLikeButton('React 資深工程師'));

    expect(await screen.findByText('喜歡的原因')).toBeInTheDocument();
    expect(setJobPreference).not.toHaveBeenCalled();
  });

  it('writes with the chosen reason and removes the job on confirm (2.4)', async () => {
    signIn();
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(await rowLikeButton('React 資深工程師'));
    await screen.findByText('喜歡的原因');
    await user.click(screen.getByRole('button', { name: '確認' }));

    await waitFor(() => expect(setJobPreference).toHaveBeenCalledWith('job-1', 'like', '未分類'));
    await waitFor(() => expect(screen.queryByText('React 資深工程師')).not.toBeInTheDocument());
    expect(screen.queryByText('喜歡的原因')).not.toBeInTheDocument();
  });

  it('writes nothing and keeps the job listed on cancel (2.5)', async () => {
    signIn();
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(await rowLikeButton('React 資深工程師'));
    await screen.findByText('喜歡的原因');
    await user.click(screen.getByRole('button', { name: '取消' }));

    expect(screen.queryByText('喜歡的原因')).not.toBeInTheDocument();
    expect(setJobPreference).not.toHaveBeenCalled();
    expect(screen.getByText('React 資深工程師')).toBeInTheDocument();
  });

  it('keeps the drawer on the original job when the drawer mark is cancelled (2.1, 2.5)', async () => {
    signIn();
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await openDrawer(user, 'React 資深工程師');

    await user.click(drawerLikeButton());
    // The fly-out feedback holds briefly before the dialog opens.
    expect(await screen.findByText('喜歡的原因')).toBeInTheDocument();
    expect(setJobPreference).not.toHaveBeenCalled();
    expect(screen.getByTestId('selected')).toHaveTextContent('job-1');

    await user.click(screen.getByRole('button', { name: '取消' }));

    expect(screen.getByTestId('selected')).toHaveTextContent('job-1');
    expect(setJobPreference).not.toHaveBeenCalled();
    // The card returns and the drawer buttons stay usable.
    expect(drawerLikeButton()).toBeEnabled();
  });

  it('moves the drawer to the next job, then writes, on drawer confirm (2.4)', async () => {
    signIn();
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await openDrawer(user, 'React 資深工程師');

    await user.click(drawerLikeButton());
    await screen.findByText('喜歡的原因');
    await user.click(screen.getByRole('button', { name: '確認' }));

    expect(screen.getByTestId('selected')).toHaveTextContent('job-2');
    await waitFor(() => expect(setJobPreference).toHaveBeenCalledWith('job-1', 'like', '未分類'));
  });

  it('shows only the login prompt to a guest (2.7)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(await rowLikeButton('React 資深工程師'));

    expect(await screen.findByText('需要登入')).toBeInTheDocument();
    expect(screen.queryByText('喜歡的原因')).not.toBeInTheDocument();
    expect(setJobPreference).not.toHaveBeenCalled();
  });

  it('restores the job and shows an error when the write fails (2.8)', async () => {
    signIn();
    vi.mocked(setJobPreference).mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(await rowLikeButton('React 資深工程師'));
    await screen.findByText('喜歡的原因');
    await user.click(screen.getByRole('button', { name: '確認' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('標記失敗，請再試一次');
    expect(screen.getByText('React 資深工程師')).toBeInTheDocument();
  });
});
