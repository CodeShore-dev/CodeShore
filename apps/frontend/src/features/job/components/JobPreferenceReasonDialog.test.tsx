import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JobPreferenceReasonDialog } from './JobPreferenceReasonDialog';

type QueryState = { data?: { reason: string; job_count: number }[]; isError?: boolean };
type MutateOptions = { onSuccess?: () => void; onError?: () => void };

const queryState: { current: QueryState } = { current: {} };
const usePreferenceReasonsQuery = vi.fn<
  (preference: 'like' | 'dislike', enabled?: boolean) => QueryState
>(() => queryState.current);
const mutate = vi.fn<
  (vars: { preference: 'like' | 'dislike'; reason: string }, opts?: MutateOptions) => void
>();

vi.mock('../queries', () => ({
  usePreferenceReasonsQuery: (p: 'like' | 'dislike', e?: boolean) =>
    usePreferenceReasonsQuery(p, e),
}));
vi.mock('../mutations', () => ({
  useDeletePreferenceReasonMutation: () => ({ mutate, isPending: false }),
}));

const SERVER = [
  { reason: '未分類', job_count: 4 },
  { reason: '遠端工作', job_count: 3 },
];

function setup(props: Partial<Parameters<typeof JobPreferenceReasonDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const all = {
    open: true,
    preference: 'like' as const,
    initialReason: null,
    onConfirm,
    onCancel,
    ...props,
  };
  const utils = render(<JobPreferenceReasonDialog {...all} />);
  return { ...utils, all, onConfirm, onCancel, user: userEvent.setup() };
}

async function addReason(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(screen.getByRole('textbox', { name: '新增子分類' }), name);
  await user.click(screen.getByRole('button', { name: '新增' }));
}

beforeEach(() => {
  queryState.current = { data: SERVER };
  usePreferenceReasonsQuery.mockClear();
  mutate.mockReset();
});

describe('JobPreferenceReasonDialog', () => {
  it('shows the title for each preference (2.2)', () => {
    const { rerender, all } = setup();
    expect(screen.getByText('喜歡的原因')).toBeInTheDocument();
    rerender(<JobPreferenceReasonDialog {...all} preference="dislike" />);
    expect(screen.getByText('不喜歡的原因')).toBeInTheDocument();
  });

  it('only enables the query while open and renders nothing when closed', () => {
    setup({ open: false });
    expect(screen.queryByText('喜歡的原因')).not.toBeInTheDocument();
    expect(usePreferenceReasonsQuery).not.toHaveBeenCalledWith('like', true);
  });

  it('preselects initialReason when it exists (6.2)', () => {
    setup({ initialReason: '遠端工作' });
    expect(screen.getByRole('radio', { name: '遠端工作' })).toBeChecked();
  });

  it('falls back to 未分類 for an unknown initialReason (6.4)', () => {
    setup({ initialReason: '不存在' });
    expect(screen.getByRole('radio', { name: '未分類' })).toBeChecked();
  });

  it('re-resolves the preselection once data arrives after opening', () => {
    queryState.current = {};
    const { rerender, all } = setup({ initialReason: '遠端工作' });
    expect(screen.getByRole('radio', { name: '未分類' })).toBeChecked();
    queryState.current = { data: SERVER };
    rerender(<JobPreferenceReasonDialog {...all} />);
    expect(screen.getByRole('radio', { name: '遠端工作' })).toBeChecked();
  });

  it('still shows 未分類 and allows confirm when loading fails (2.3)', async () => {
    queryState.current = { isError: true };
    const { user, onConfirm } = setup({ initialReason: '遠端工作' });
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(screen.getByRole('radio', { name: '未分類' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: '確認' }));
    expect(onConfirm).toHaveBeenCalledWith('未分類');
  });

  it('adds a new name and selects it (4.1)', async () => {
    const { user } = setup();
    await addReason(user, '  薪水高 ');
    expect(screen.getByRole('radio', { name: '薪水高' })).toBeChecked();
  });

  it('selects the existing item for a duplicate name (4.5)', async () => {
    const { user } = setup();
    await addReason(user, '遠端工作');
    expect(screen.getAllByRole('radio', { name: '遠端工作' })).toHaveLength(1);
    expect(screen.getByRole('radio', { name: '遠端工作' })).toBeChecked();
  });

  it('removes a draft locally without calling the API', async () => {
    const { user } = setup();
    await addReason(user, '薪水高');
    await user.click(screen.getByRole('button', { name: '刪除「薪水高」' }));
    expect(screen.queryByRole('radio', { name: '薪水高' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '未分類' })).toBeChecked();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('confirms a server delete with the job count, then calls the mutation (5.2, 5.3)', async () => {
    const { user } = setup({ preference: 'dislike' });
    await user.click(screen.getByRole('button', { name: '刪除「遠端工作」' }));
    expect(screen.getByText('3 個職缺會改回『未分類』')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '刪除' }));
    expect(mutate).toHaveBeenCalledWith(
      { preference: 'dislike', reason: '遠端工作' },
      expect.any(Object),
    );
    expect(screen.queryByText('3 個職缺會改回『未分類』')).not.toBeInTheDocument();
  });

  it('selects 未分類 after the selected item is deleted (5.5)', async () => {
    const { user, rerender, all } = setup({ initialReason: '遠端工作' });
    await user.click(screen.getByRole('button', { name: '刪除「遠端工作」' }));
    await user.click(screen.getByRole('button', { name: '刪除' }));
    act(() => mutate.mock.calls[0][1]?.onSuccess?.());
    queryState.current = { data: [SERVER[0]] };
    rerender(<JobPreferenceReasonDialog {...all} />);
    expect(screen.getByRole('radio', { name: '未分類' })).toBeChecked();
    expect(screen.queryByText('刪除失敗')).not.toBeInTheDocument();
  });

  it('shows 刪除失敗 when the delete fails and keeps the list', async () => {
    const { user } = setup({ initialReason: '遠端工作' });
    await user.click(screen.getByRole('button', { name: '刪除「遠端工作」' }));
    await user.click(screen.getByRole('button', { name: '刪除' }));
    act(() => mutate.mock.calls[0][1]?.onError?.());
    expect(screen.getByText('刪除失敗')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '遠端工作' })).toBeChecked();
  });

  it('cancels on Esc (2.5)', async () => {
    const { user, onCancel } = setup();
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('cancels on the 取消 button and the backdrop (2.5)', async () => {
    const { user, onCancel } = setup();
    await user.click(screen.getByRole('button', { name: '取消' }));
    await user.pointer({ keys: '[MouseLeft>]', target: screen.getByTestId('modal-backdrop') });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('Esc while the delete confirm is open only closes the confirm', async () => {
    const { user, onCancel } = setup();
    await user.click(screen.getByRole('button', { name: '刪除「遠端工作」' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByText('3 個職缺會改回『未分類』')).not.toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByText('喜歡的原因')).toBeInTheDocument();
  });

  it('ignores Esc while an IME composition is active', () => {
    const { onCancel } = setup();
    fireEvent.keyDown(document, { key: 'Escape', isComposing: true });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('dismissing the delete confirm by its backdrop does not cancel the dialog', async () => {
    const { user, onCancel } = setup();
    await user.click(screen.getByRole('button', { name: '刪除「遠端工作」' }));
    const confirmBackdrop =
      screen.getByText('3 個職缺會改回『未分類』').parentElement?.parentElement;
    expect(confirmBackdrop).toBeTruthy();
    fireEvent.mouseDown(confirmBackdrop as HTMLElement);
    expect(screen.queryByText('3 個職缺會改回『未分類』')).not.toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('falls back to 未分類 when the item picked during a delete is removed', async () => {
    const { user, rerender, all, onConfirm } = setup();
    await user.click(screen.getByRole('button', { name: '刪除「遠端工作」' }));
    await user.click(screen.getByRole('button', { name: '刪除' }));
    // The user picks the item while its delete is still in flight.
    await user.click(screen.getByRole('radio', { name: '遠端工作' }));
    act(() => mutate.mock.calls[0][1]?.onSuccess?.());
    queryState.current = { data: [SERVER[0]] };
    rerender(<JobPreferenceReasonDialog {...all} />);
    await user.click(screen.getByRole('button', { name: '確認' }));
    expect(onConfirm).toHaveBeenCalledWith('未分類');
  });

  it('drops drafts and selection after close and reopen (4.6)', async () => {
    const { user, rerender, all } = setup();
    await addReason(user, '薪水高');
    rerender(<JobPreferenceReasonDialog {...all} open={false} />);
    rerender(<JobPreferenceReasonDialog {...all} open />);
    expect(screen.queryByRole('radio', { name: '薪水高' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '未分類' })).toBeChecked();
  });

  it('confirms with the selected reason', async () => {
    const { user, onConfirm } = setup();
    await user.click(screen.getByText('遠端工作'));
    await user.click(screen.getByRole('button', { name: '確認' }));
    expect(onConfirm).toHaveBeenCalledWith('遠端工作');
  });
});
