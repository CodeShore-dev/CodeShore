import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(
      <ConfirmDialog
        open={false}
        title="清空喜歡清單"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('清空喜歡清單')).not.toBeInTheDocument();
  });

  it('renders the title and description when open is true', () => {
    render(
      <ConfirmDialog
        open
        title="清空喜歡清單"
        description="此操作將刪除所有已保存的喜歡紀錄，且無法復原。"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('清空喜歡清單')).toBeInTheDocument();
    expect(
      screen.getByText('此操作將刪除所有已保存的喜歡紀錄，且無法復原。'),
    ).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        open
        title="清空喜歡清單"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByText('確認'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel when the cancel button is clicked', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        open
        title="清空喜歡清單"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByText('取消'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('uses custom confirm/cancel labels when provided', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        open
        title="清空喜歡清單"
        confirmLabel="刪除"
        cancelLabel="返回"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByText('確認')).not.toBeInTheDocument();
    expect(screen.queryByText('取消')).not.toBeInTheDocument();

    await user.click(screen.getByText('刪除'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
