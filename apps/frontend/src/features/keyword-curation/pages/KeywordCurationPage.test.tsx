import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useKeywordQueueQuery } = vi.hoisted(() => ({
  useKeywordQueueQuery: vi.fn(),
}));
vi.mock('../queries', () => ({ useKeywordQueueQuery }));

const { useStartSessionMutation, useResumeSessionMutation } = vi.hoisted(
  () => ({
    useStartSessionMutation: vi.fn(),
    useResumeSessionMutation: vi.fn(),
  }),
);
vi.mock('../mutations', () => ({
  useStartSessionMutation,
  useResumeSessionMutation,
}));

import { INITIAL_CURATION_STATE, useCurationStore } from '../curationStore';
import type { QueuedKeyword } from '../service';
import { KeywordCurationPage } from './KeywordCurationPage';

function makeKeywords(): QueuedKeyword[] {
  return [
    { id: 'vue', count: 12, affectedJobCount: 4 },
    { id: 'react', count: 42, affectedJobCount: 10 },
    { id: 'svelte', count: 30, affectedJobCount: 6 },
  ];
}

// KeywordCurationPage (task 7.1, requirements 1.1, 1.3, 2.1, 8.1, 8.2): the
// two-column page container assembling KeywordQueueList (left) and
// CurationSession (right), wiring keyword selection to
// useStartSessionMutation. Both child components fetch/mutate via mocked
// hooks (../queries, ../mutations) so this test exercises only the page's
// own wiring -- not the already-tested internals of the queue query, the
// mutation hooks, or CurationSession's session-status rendering.
describe('KeywordCurationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCurationStore.setState(INITIAL_CURATION_STATE);
    useResumeSessionMutation.mockReturnValue({ mutate: vi.fn() });
  });

  it('renders both KeywordQueueList and CurationSession fully (task completion criterion: page renders fully)', () => {
    useKeywordQueueQuery.mockReturnValue({
      data: { keywords: makeKeywords() },
      isLoading: false,
    });
    useStartSessionMutation.mockReturnValue({ mutate: vi.fn() });

    render(<KeywordCurationPage />);

    // KeywordQueueList content
    expect(screen.getByRole('button', { name: /react/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /vue/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /svelte/ })).toBeInTheDocument();

    // CurationSession content (idle placeholder, since sessionStatus is idle)
    expect(
      screen.getByText('請從左側選擇一個 keyword 開始策展'),
    ).toBeInTheDocument();
  });

  it('shows the remaining/total progress count derived from the queue length (requirement 8.1)', () => {
    useKeywordQueueQuery.mockReturnValue({
      data: { keywords: makeKeywords() },
      isLoading: false,
    });
    useStartSessionMutation.mockReturnValue({ mutate: vi.fn() });

    render(<KeywordCurationPage />);

    // 0 processed, 3 total, on first load
    expect(screen.getByTestId('curation-progress-count')).toHaveTextContent(
      '0 / 3',
    );
  });

  it('selecting a keyword triggers useStartSessionMutation.mutate with the correct keyword, and the right panel reflects the loading state once the store updates (requirement 2.1)', async () => {
    useKeywordQueueQuery.mockReturnValue({
      data: { keywords: makeKeywords() },
      isLoading: false,
    });
    const mutate = vi.fn();
    useStartSessionMutation.mockReturnValue({ mutate });
    const user = userEvent.setup();

    render(<KeywordCurationPage />);

    await user.click(screen.getByRole('button', { name: /react/ }));

    expect(mutate).toHaveBeenCalledWith('react');

    // Simulate what useStartSessionMutation's own onMutate does internally
    // (already covered by that hook's own tests) to prove the page's
    // right-panel wiring (CurationSession reading curationStore) correctly
    // reflects a 'loading' session once the store transitions.
    act(() => {
      useCurationStore.getState().startSession('react');
    });

    expect(screen.getByTestId('curation-session-loading')).toHaveTextContent(
      'react',
    );
  });

  it('after a successful resume, the just-resolved keyword no longer appears in the queue list, and the progress count updates', () => {
    useStartSessionMutation.mockReturnValue({ mutate: vi.fn() });
    useKeywordQueueQuery.mockReturnValue({
      data: { keywords: makeKeywords() },
      isLoading: false,
    });

    const { rerender } = render(<KeywordCurationPage />);

    expect(screen.getByRole('button', { name: /react/ })).toBeInTheDocument();
    expect(screen.getByTestId('curation-progress-count')).toHaveTextContent(
      '0 / 3',
    );

    // Simulate a resolved resume: the queue query re-resolves without the
    // just-processed keyword (this is useKeywordQueueQuery's own
    // cache-invalidation behavior, already covered by task 5.3's tests --
    // here we only prove the page's rendering wiring reacts correctly to
    // updated query data).
    useKeywordQueueQuery.mockReturnValue({
      data: {
        keywords: makeKeywords().filter(k => k.id !== 'react'),
      },
      isLoading: false,
    });

    rerender(<KeywordCurationPage />);

    expect(
      screen.queryByRole('button', { name: /react/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /vue/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /svelte/ })).toBeInTheDocument();
    expect(screen.getByTestId('curation-progress-count')).toHaveTextContent(
      '1 / 3',
    );
  });
});
