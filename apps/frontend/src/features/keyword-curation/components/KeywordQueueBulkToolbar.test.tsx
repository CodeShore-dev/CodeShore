import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mutateAsync } = vi.hoisted(() => ({ mutateAsync: vi.fn() }));

vi.mock('../mutations', () => ({
  useBulkExcludeKeywordsMutation: () => ({
    mutateAsync,
    isPending: false,
  }),
}));

import { useQueueStore } from '../queueStore';
import type { QueuedKeyword } from '../service';
import { KeywordQueueBulkToolbar } from './KeywordQueueBulkToolbar';

const keywords: QueuedKeyword[] = [
  { id: 'react', count: 42, affectedJobCount: 10 },
  { id: 'vue', count: 12, affectedJobCount: 4 },
];

beforeEach(() => {
  vi.clearAllMocks();
  useQueueStore.setState({
    currentPage: 1,
    selectMode: false,
    selectedIds: new Set(),
  });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('KeywordQueueBulkToolbar', () => {
  it('renders nothing when not in select mode', () => {
    const { container } = render(<KeywordQueueBulkToolbar keywords={keywords} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the selected/total count and toggles select-all for the current page', async () => {
    useQueueStore.setState({ selectMode: true });
    const user = userEvent.setup();

    render(<KeywordQueueBulkToolbar keywords={keywords} />);
    expect(screen.getByText('已選 0 / 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /全選本頁/ }));
    expect([...useQueueStore.getState().selectedIds].sort()).toEqual([
      'react',
      'vue',
    ]);

    await user.click(screen.getByRole('button', { name: /取消全選/ }));
    expect(useQueueStore.getState().selectedIds.size).toBe(0);
  });

  it('bulk-excludes the selected keywords after confirmation and clears the selection', async () => {
    useQueueStore.setState({
      selectMode: true,
      selectedIds: new Set(['react']),
    });
    mutateAsync.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<KeywordQueueBulkToolbar keywords={keywords} />);
    await user.click(screen.getByRole('button', { name: /加入 Keyword Bin/ }));

    expect(window.confirm).toHaveBeenCalled();
    expect(mutateAsync).toHaveBeenCalledWith(['react']);
    expect(useQueueStore.getState().selectedIds.size).toBe(0);
  });

  it('does not bulk-exclude when the confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    useQueueStore.setState({
      selectMode: true,
      selectedIds: new Set(['react']),
    });
    const user = userEvent.setup();

    render(<KeywordQueueBulkToolbar keywords={keywords} />);
    await user.click(screen.getByRole('button', { name: /加入 Keyword Bin/ }));

    expect(mutateAsync).not.toHaveBeenCalled();
    expect(useQueueStore.getState().selectedIds.has('react')).toBe(true);
  });

  it('disables the bulk-exclude button when nothing is selected', () => {
    useQueueStore.setState({ selectMode: true });

    render(<KeywordQueueBulkToolbar keywords={keywords} />);

    expect(
      screen.getByRole('button', { name: /加入 Keyword Bin/ }),
    ).toBeDisabled();
  });
});
