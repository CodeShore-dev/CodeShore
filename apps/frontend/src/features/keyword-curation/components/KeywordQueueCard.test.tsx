import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useQueueStore } from '../queueStore';
import type { QueuedKeyword } from '../service';
import { KeywordQueueCard } from './KeywordQueueCard';

const keyword: QueuedKeyword = { id: 'react', count: 42, affectedJobCount: 10 };

beforeEach(() => {
  useQueueStore.setState({
    currentPage: 1,
    selectMode: false,
    selectedIds: new Set(),
  });
});

describe('KeywordQueueCard', () => {
  it('calls onSelectKeyword on click when not in select mode', async () => {
    const onSelectKeyword = vi.fn();
    const user = userEvent.setup();

    render(
      <ul>
        <KeywordQueueCard
          keyword={keyword}
          disabled={false}
          onSelectKeyword={onSelectKeyword}
        />
      </ul>,
    );

    await user.click(screen.getByRole('button'));

    expect(onSelectKeyword).toHaveBeenCalledWith('react');
  });

  it('does not render a checkbox when not in select mode', () => {
    render(
      <ul>
        <KeywordQueueCard keyword={keyword} disabled={false} onSelectKeyword={vi.fn()} />
      </ul>,
    );

    expect(
      screen.queryByTestId('keyword-queue-card-checkbox'),
    ).not.toBeInTheDocument();
  });

  it('toggles selection instead of calling onSelectKeyword while in select mode', async () => {
    useQueueStore.setState({ selectMode: true });
    const onSelectKeyword = vi.fn();
    const user = userEvent.setup();

    render(
      <ul>
        <KeywordQueueCard
          keyword={keyword}
          disabled={false}
          onSelectKeyword={onSelectKeyword}
        />
      </ul>,
    );

    await user.click(screen.getByRole('button'));

    expect(onSelectKeyword).not.toHaveBeenCalled();
    expect(useQueueStore.getState().selectedIds.has('react')).toBe(true);

    await user.click(screen.getByRole('button'));
    expect(useQueueStore.getState().selectedIds.has('react')).toBe(false);
  });

  it('remains clickable in select mode even when a session is in progress elsewhere', async () => {
    useQueueStore.setState({ selectMode: true });
    const onSelectKeyword = vi.fn();
    const user = userEvent.setup();

    render(
      <ul>
        <KeywordQueueCard
          keyword={keyword}
          disabled={true}
          onSelectKeyword={onSelectKeyword}
        />
      </ul>,
    );

    const button = screen.getByRole('button');
    expect(button).not.toBeDisabled();
    await user.click(button);
    expect(useQueueStore.getState().selectedIds.has('react')).toBe(true);
  });

  it('is disabled and non-clickable when not in select mode and a session is in progress', async () => {
    const onSelectKeyword = vi.fn();
    const user = userEvent.setup();

    render(
      <ul>
        <KeywordQueueCard
          keyword={keyword}
          disabled={true}
          onSelectKeyword={onSelectKeyword}
        />
      </ul>,
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onSelectKeyword).not.toHaveBeenCalled();
  });
});
