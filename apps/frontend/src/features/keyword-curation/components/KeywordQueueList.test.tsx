import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useKeywordQueueQuery } = vi.hoisted(() => ({
  useKeywordQueueQuery: vi.fn(),
}));

vi.mock('../queries', () => ({ useKeywordQueueQuery }));

import { INITIAL_CURATION_STATE, useCurationStore } from '../curationStore';
import type { QueuedKeyword } from '../service';
import { KeywordQueueList } from './KeywordQueueList';

function makeKeywords(): QueuedKeyword[] {
  return [
    { id: 'vue', count: 12, affectedJobCount: 4 },
    { id: 'react', count: 42, affectedJobCount: 10 },
    { id: 'svelte', count: 30, affectedJobCount: 6 },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  useCurationStore.setState(INITIAL_CURATION_STATE);
});

// KeywordQueueList (task 6.1, requirements 1.1-1.3, 2.3): the unmapped
// keyword sidebar. Reads useKeywordQueueQuery() for server data and
// useCurationStore directly for session-in-progress gating, so the
// component only needs an onSelectKeyword callback prop.
describe('KeywordQueueList', () => {
  it('renders each keyword id, count, and affectedJobCount sorted by count descending (requirement 1.1, 1.2)', () => {
    useKeywordQueueQuery.mockReturnValue({
      data: { keywords: makeKeywords() },
      isLoading: false,
    });

    render(<KeywordQueueList onSelectKeyword={vi.fn()} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons.map(b => b.textContent)).toEqual([
      expect.stringContaining('react'),
      expect.stringContaining('svelte'),
      expect.stringContaining('vue'),
    ]);

    const reactButton = screen.getByRole('button', { name: /react/ });
    expect(reactButton.textContent).toContain('42');
    expect(reactButton.textContent).toContain('10');
  });

  it('shows the "所有合格 keyword 均已處理完畢" empty-state message when the queue is empty (requirement 1.3)', () => {
    useKeywordQueueQuery.mockReturnValue({
      data: { keywords: [] },
      isLoading: false,
    });

    render(<KeywordQueueList onSelectKeyword={vi.fn()} />);

    expect(
      screen.getByText('所有合格 keyword 均已處理完畢'),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('does not show the empty-state message while the query is still loading', () => {
    useKeywordQueueQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    render(<KeywordQueueList onSelectKeyword={vi.fn()} />);

    expect(
      screen.queryByText('所有合格 keyword 均已處理完畢'),
    ).not.toBeInTheDocument();
  });

  it('disables keyword selection while a session is interrupted (requirement 2.3)', async () => {
    useKeywordQueueQuery.mockReturnValue({
      data: { keywords: makeKeywords() },
      isLoading: false,
    });
    useCurationStore.setState({
      ...INITIAL_CURATION_STATE,
      activeKeyword: 'react',
      sessionStatus: 'interrupted',
    });
    const onSelectKeyword = vi.fn();
    const user = userEvent.setup();

    render(<KeywordQueueList onSelectKeyword={onSelectKeyword} />);

    const vueButton = screen.getByRole('button', { name: /vue/ });
    expect(vueButton).toBeDisabled();
    await user.click(vueButton);
    expect(onSelectKeyword).not.toHaveBeenCalled();
  });

  it('disables keyword selection while a session is loading (requirement 2.3)', async () => {
    useKeywordQueueQuery.mockReturnValue({
      data: { keywords: makeKeywords() },
      isLoading: false,
    });
    useCurationStore.setState({
      ...INITIAL_CURATION_STATE,
      activeKeyword: 'react',
      sessionStatus: 'loading',
    });
    const onSelectKeyword = vi.fn();
    const user = userEvent.setup();

    render(<KeywordQueueList onSelectKeyword={onSelectKeyword} />);

    const svelteButton = screen.getByRole('button', { name: /svelte/ });
    expect(svelteButton).toBeDisabled();
    await user.click(svelteButton);
    expect(onSelectKeyword).not.toHaveBeenCalled();
  });

  it('allows selection and calls onSelectKeyword when no session is in progress', async () => {
    useKeywordQueueQuery.mockReturnValue({
      data: { keywords: makeKeywords() },
      isLoading: false,
    });
    const onSelectKeyword = vi.fn();
    const user = userEvent.setup();

    render(<KeywordQueueList onSelectKeyword={onSelectKeyword} />);

    const reactButton = screen.getByRole('button', { name: /react/ });
    expect(reactButton).not.toBeDisabled();
    await user.click(reactButton);
    expect(onSelectKeyword).toHaveBeenCalledWith('react');
  });

  it('re-enables selection after the session returns to done/idle', async () => {
    useKeywordQueueQuery.mockReturnValue({
      data: { keywords: makeKeywords() },
      isLoading: false,
    });
    useCurationStore.setState({
      ...INITIAL_CURATION_STATE,
      sessionStatus: 'done',
    });
    const onSelectKeyword = vi.fn();
    const user = userEvent.setup();

    render(<KeywordQueueList onSelectKeyword={onSelectKeyword} />);

    const vueButton = screen.getByRole('button', { name: /vue/ });
    expect(vueButton).not.toBeDisabled();
    await user.click(vueButton);
    expect(onSelectKeyword).toHaveBeenCalledWith('vue');
  });
});
