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

// A tiny fake backend: each job lives in the tab matching its stored
// preference, so the list reflects a write even after the settle-time refetch.
const { marked, makeJob } = vi.hoisted(() => ({
  marked: new Map<string, { preference: string; reason: string }>(),
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
  fetchJobs: vi.fn(async ({ where }: { where: string }) => {
    const tab = JSON.parse(where).preference?.eq ?? null;
    const all = [makeJob('job-1', 'React 資深工程師'), makeJob('job-2', 'Vue 前端工程師')]
      .filter(job => (marked.get(job.id)?.preference ?? null) === tab)
      .map(job => ({ ...job, preference_reason: marked.get(job.id)?.reason }));
    return { result: all, count: all.length };
  }),
  fetchJobPreferencedCount: vi.fn().mockResolvedValue({ liked_count: 0, disliked_count: 0 }),
  fetchPreferenceReasons: vi.fn().mockResolvedValue([
    { reason: '未分類', job_count: 0 },
    { reason: '薪水高', job_count: 1 },
    { reason: '遠端', job_count: 0 },
  ]),
  deletePreferenceReason: vi.fn().mockResolvedValue({}),
  clearJobPreferences: vi.fn().mockResolvedValue({}),
  fetchLocationGroups: vi.fn().mockResolvedValue({ result: [] }),
  setJobPreference: vi.fn(async (id: string, preference: string, reason: string) => {
    marked.set(id, { preference, reason });
    return {};
  }),
  createCrawlEventSource: vi.fn(() => ({ close: vi.fn() })),
}));

vi.mock('../../keyword/service', () => ({
  fetchMvTech: vi.fn().mockResolvedValue({ result: [] }),
}));

// Page-like harness: real jobs query, real guest gate, local drawer
// selection, so the test covers the whole marking path around JobList.
function Harness({ preference = null }: { preference?: 'like' | 'dislike' | null }) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const { promptOpen, requestPreference } = useGuestPreferenceGate();
  const query = useJobsQuery({
    preference,
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
        listViewPreference={preference}
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

describe('JobList change reason on the like / dislike tabs (task 8.4)', () => {
  function seedLiked() {
    marked.set('job-1', { preference: 'like', reason: '薪水高' });
    marked.set('job-2', { preference: 'like', reason: '未分類' });
  }

  async function row(title: string) {
    return (await screen.findByText(title)).closest('li') as HTMLElement;
  }

  it('shows 改分類 instead of like on the 喜歡 tab, keeping dislike enabled (8.1)', async () => {
    signIn();
    seedLiked();
    renderWithProviders(<Harness preference="like" />);

    const item = await row('React 資深工程師');
    expect(within(item).getByRole('button', { name: '改分類' })).toBeEnabled();
    expect(within(item).queryByText('favorite')).not.toBeInTheDocument();
    expect(within(item).getByText('close').closest('button')).toBeEnabled();
  });

  it('shows 改分類 instead of dislike on the 不喜歡 tab (8.1)', async () => {
    signIn();
    marked.set('job-1', { preference: 'dislike', reason: '未分類' });
    renderWithProviders(<Harness preference="dislike" />);

    const item = await row('React 資深工程師');
    expect(within(item).getByRole('button', { name: '改分類' })).toBeEnabled();
    expect(within(item).queryByText('close')).not.toBeInTheDocument();
    expect(within(item).getByText('favorite').closest('button')).toBeEnabled();
  });

  it('keeps like and dislike with no 改分類 on the 總數 tab (8.1)', async () => {
    signIn();
    renderWithProviders(<Harness />);

    const item = await row('React 資深工程師');
    expect(within(item).queryByRole('button', { name: '改分類' })).not.toBeInTheDocument();
    expect(within(item).getByText('favorite').closest('button')).toBeEnabled();
    expect(within(item).getByText('close').closest('button')).toBeEnabled();
  });

  it('opens the change dialog with the current reason preselected (8.2)', async () => {
    signIn();
    seedLiked();
    const user = userEvent.setup();
    renderWithProviders(<Harness preference="like" />);

    await user.click(within(await row('React 資深工程師')).getByRole('button', { name: '改分類' }));

    expect(await screen.findByText('修改喜歡的原因')).toBeInTheDocument();
    expect(await screen.findByRole('radio', { name: '薪水高' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('selected')).toHaveTextContent('none');
  });

  it('changes only the reason and keeps the job listed on confirm (8.3, 8.6)', async () => {
    signIn();
    seedLiked();
    const user = userEvent.setup();
    renderWithProviders(<Harness preference="like" />);

    await user.click(within(await row('React 資深工程師')).getByRole('button', { name: '改分類' }));
    await user.click(await screen.findByRole('radio', { name: '遠端' }));
    await user.click(screen.getByRole('button', { name: '確認' }));

    await waitFor(() => expect(setJobPreference).toHaveBeenCalledWith('job-1', 'like', '遠端'));
    expect(screen.queryByText('修改喜歡的原因')).not.toBeInTheDocument();
    await waitFor(async () => expect(within(await row('React 資深工程師')).getByText('遠端')).toBeInTheDocument());
  });

  it('writes nothing on cancel (8.5)', async () => {
    signIn();
    seedLiked();
    const user = userEvent.setup();
    renderWithProviders(<Harness preference="like" />);

    await user.click(within(await row('React 資深工程師')).getByRole('button', { name: '改分類' }));
    await screen.findByText('修改喜歡的原因');
    await user.click(screen.getByRole('button', { name: '取消' }));

    expect(screen.queryByText('修改喜歡的原因')).not.toBeInTheDocument();
    expect(setJobPreference).not.toHaveBeenCalled();
    expect(within(await row('React 資深工程師')).getByText('薪水高')).toBeInTheDocument();
  });

  it('reverts the badge and shows 修改失敗 when the change fails (8.7)', async () => {
    signIn();
    seedLiked();
    vi.mocked(setJobPreference).mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    renderWithProviders(<Harness preference="like" />);

    await user.click(within(await row('React 資深工程師')).getByRole('button', { name: '改分類' }));
    await user.click(await screen.findByRole('radio', { name: '遠端' }));
    await user.click(screen.getByRole('button', { name: '確認' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('修改失敗，請再試一次');
    await waitFor(async () => expect(within(await row('React 資深工程師')).getByText('薪水高')).toBeInTheDocument());
  });

  it('opens the change dialog from the drawer (8.1, 8.2)', async () => {
    signIn();
    seedLiked();
    const user = userEvent.setup();
    renderWithProviders(<Harness preference="like" />);
    await user.click(await screen.findByText('React 資深工程師'));
    await screen.findByText('● 喜歡的職缺');

    const drawerButton = screen
      .getAllByRole('button', { name: '改分類' })
      .find(el => el.closest('li') === null) as HTMLElement;
    await user.click(drawerButton);

    expect(await screen.findByText('修改喜歡的原因')).toBeInTheDocument();
    expect(await screen.findByRole('radio', { name: '薪水高' })).toHaveAttribute('aria-checked', 'true');
  });
});
