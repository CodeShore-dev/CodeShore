import type { ReactElement } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useJobFilterStore } from '../jobFilterStore';
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
type RenameOptions = { onSuccess?: () => void; onError?: (error: unknown) => void };
const renameMutate = vi.fn<
  (
    vars: { preference: 'like' | 'dislike'; reason: string; name: string },
    opts?: RenameOptions,
  ) => void
>();
const memory = { read: vi.fn<(p: 'like' | 'dislike') => string | null>(), remember: vi.fn() };

vi.mock('../mutations', () => ({
  useDeletePreferenceReasonMutation: () => ({ mutate, isPending: false }),
  useRenamePreferenceReasonMutation: () => ({ mutate: renameMutate, isPending: false }),
}));
vi.mock('../hooks/useLastReasonMemory', () => ({
  useLastReasonMemory: () => memory,
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
  renameMutate.mockReset();
  memory.read.mockReset().mockReturnValue(null);
  memory.remember.mockReset();
  useJobFilterStore.getState().reset();
});

async function rename(user: ReturnType<typeof userEvent.setup>, from: string, to: string) {
  await user.click(screen.getByRole('button', { name: `改名「${from}」` }));
  const input = screen.getByRole('textbox', { name: '新名稱' });
  await user.clear(input);
  if (to) await user.type(input, to);
  await user.click(screen.getByRole('button', { name: '儲存' }));
}

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

  it('adding a new name confirms the mark with it right away (4.1)', async () => {
    const { user, onConfirm } = setup();
    await addReason(user, '  薪水高 ');
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('薪水高');
  });

  it('pressing Enter in the input also confirms right away (4.1)', async () => {
    const { user, onConfirm } = setup();
    await user.type(screen.getByRole('textbox', { name: '新增子分類' }), '通勤近{Enter}');
    expect(onConfirm).toHaveBeenCalledWith('通勤近');
  });

  it('does not confirm when the typed name is invalid (4.3)', async () => {
    const { user, onConfirm } = setup();
    await user.type(screen.getByRole('textbox', { name: '新增子分類' }), '   {Enter}');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('請輸入名稱')).toBeInTheDocument();
  });

  it('does not confirm a name over 20 characters (4.4)', async () => {
    const { user, onConfirm } = setup();
    await addReason(user, '字'.repeat(21));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('最多 20 個字')).toBeInTheDocument();
  });

  it('turns the footer button into 新增 only while the input has text', async () => {
    const { user } = setup();
    const input = screen.getByRole('textbox', { name: '新增子分類' });
    expect(screen.getByRole('button', { name: '確認' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新增' })).not.toBeInTheDocument();
    await user.type(input, '  ');
    expect(screen.getByRole('button', { name: '確認' })).toBeInTheDocument();
    await user.type(input, '薪');
    expect(screen.getByRole('button', { name: '新增' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '確認' })).not.toBeInTheDocument();
    await user.clear(input);
    expect(screen.getByRole('button', { name: '確認' })).toBeInTheDocument();
  });

  it('adding an existing name confirms with that same reason (4.5)', async () => {
    const { user, onConfirm } = setup();
    await addReason(user, '遠端工作');
    expect(onConfirm).toHaveBeenCalledWith('遠端工作');
    expect(screen.getAllByRole('radio', { name: '遠端工作' })).toHaveLength(1);
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

  it('drops typed text and selection after close and reopen (4.6)', async () => {
    const { user, rerender, all, onConfirm } = setup();
    await user.type(screen.getByRole('textbox', { name: '新增子分類' }), '薪水高');
    await user.click(screen.getByRole('radio', { name: '遠端工作' }));
    rerender(<JobPreferenceReasonDialog {...all} open={false} />);
    rerender(<JobPreferenceReasonDialog {...all} open />);
    expect(screen.getByRole('textbox', { name: '新增子分類' })).toHaveValue('');
    expect(screen.queryByRole('radio', { name: '薪水高' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '未分類' })).toBeChecked();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms with the selected reason', async () => {
    const { user, onConfirm } = setup();
    await user.click(screen.getByText('遠端工作'));
    await user.click(screen.getByRole('button', { name: '確認' }));
    expect(onConfirm).toHaveBeenCalledWith('遠端工作');
  });

  describe('change mode and rename (8.2, 9.x)', () => {
    it('shows the change-mode title for each preference (8.2)', () => {
      const { rerender, all } = setup({ mode: 'change' });
      expect(screen.getByText('修改喜歡的原因')).toBeInTheDocument();
      rerender(<JobPreferenceReasonDialog {...all} preference="dislike" />);
      expect(screen.getByText('修改不喜歡的原因')).toBeInTheDocument();
    });

    it('✎ turns the chip into a prefilled input (9.2)', async () => {
      const { user } = setup();
      await user.click(screen.getByRole('button', { name: '改名「遠端工作」' }));
      expect(screen.getByRole('textbox', { name: '新名稱' })).toHaveValue('遠端工作');
    });

    it('saving the same name (after trim) exits without calling the API (9.6)', async () => {
      const { user } = setup();
      await rename(user, '遠端工作', ' 遠端工作 ');
      expect(renameMutate).not.toHaveBeenCalled();
      expect(screen.queryByRole('textbox', { name: '新名稱' })).not.toBeInTheDocument();
    });

    it.each(['未分類', '薪水高'])(
      'rejects an existing name %s with 已有同名分類 (9.5)',
      async (name) => {
        queryState.current = { data: [...SERVER, { reason: '薪水高', job_count: 1 }] };
        const { user } = setup();
        await rename(user, '遠端工作', name);
        expect(renameMutate).not.toHaveBeenCalled();
        expect(screen.getByText('已有同名分類')).toBeInTheDocument();
      },
    );

    it('rejects an invalid name with the name-rule error (9.4)', async () => {
      const { user } = setup();
      await rename(user, '遠端工作', '');
      expect(renameMutate).not.toHaveBeenCalled();
      expect(screen.getByText('請輸入名稱')).toBeInTheDocument();
    });

    it('calls the mutation and moves the selection to the new name (9.7)', async () => {
      const { user, rerender, all, onConfirm } = setup();
      await user.click(screen.getByRole('radio', { name: '遠端工作' }));
      await rename(user, '遠端工作', ' 在家上班 ');
      expect(renameMutate).toHaveBeenCalledWith(
        { preference: 'like', reason: '遠端工作', name: '在家上班' },
        expect.any(Object),
      );
      act(() => renameMutate.mock.calls[0][1]?.onSuccess?.());
      expect(screen.queryByRole('textbox', { name: '新名稱' })).not.toBeInTheDocument();
      queryState.current = { data: [SERVER[0], { reason: '在家上班', job_count: 3 }] };
      rerender(<JobPreferenceReasonDialog {...all} />);
      expect(screen.getByRole('radio', { name: '在家上班' })).toBeChecked();
      await user.click(screen.getByRole('button', { name: '確認' }));
      expect(onConfirm).toHaveBeenCalledWith('在家上班');
    });

    it('moves the selection when the renamed item was the initialReason (9.7)', async () => {
      const { user, rerender, all } = setup({ initialReason: '遠端工作', mode: 'change' });
      await rename(user, '遠端工作', '在家上班');
      act(() => renameMutate.mock.calls[0][1]?.onSuccess?.());
      queryState.current = { data: [SERVER[0], { reason: '在家上班', job_count: 3 }] };
      rerender(<JobPreferenceReasonDialog {...all} />);
      expect(screen.getByRole('radio', { name: '在家上班' })).toBeChecked();
    });

    // Mirrors the real rename mutation: the cached reason list is rewritten
    // (from → to) before the caller's onSuccess runs.
    function succeedRename(
      index: number,
      rerender: (ui: ReactElement) => void,
      all: Parameters<typeof JobPreferenceReasonDialog>[0],
    ) {
      const [{ reason, name }, options] = renameMutate.mock.calls[index];
      queryState.current = {
        data: (queryState.current.data ?? []).map(r =>
          r.reason === reason ? { ...r, reason: name } : r,
        ),
      };
      act(() => options?.onSuccess?.());
      rerender(<JobPreferenceReasonDialog {...all} />);
    }

    it.each([
      ['a user-picked', null],
      ['the initialReason', '遠端工作'],
    ] as const)(
      'follows the same chip renamed twice (%s selection, 9.7)',
      async (_label, initialReason) => {
        const { user, rerender, all, onConfirm } = setup({ initialReason });
        if (initialReason === null) {
          await user.click(screen.getByRole('radio', { name: '遠端工作' }));
        }
        await rename(user, '遠端工作', '在家上班');
        succeedRename(0, rerender, all);
        expect(screen.getByRole('radio', { name: '在家上班' })).toBeChecked();
        await rename(user, '在家上班', '遠距工作');
        expect(renameMutate.mock.calls[1][0]).toEqual({
          preference: 'like',
          reason: '在家上班',
          name: '遠距工作',
        });
        succeedRename(1, rerender, all);
        expect(screen.queryByRole('radio', { name: '遠端工作' })).not.toBeInTheDocument();
        expect(screen.queryByRole('radio', { name: '在家上班' })).not.toBeInTheDocument();
        expect(screen.getByRole('radio', { name: '遠距工作' })).toBeChecked();
        expect(screen.getByTestId('reason-count-遠距工作')).toHaveTextContent('3');
        await user.click(screen.getByRole('button', { name: '確認' }));
        expect(onConfirm).toHaveBeenCalledWith('遠距工作');
      },
    );

    it('keeps the selection when two different chips are renamed (9.7)', async () => {
      queryState.current = { data: [...SERVER, { reason: '薪水高', job_count: 1 }] };
      const { user, rerender, all, onConfirm } = setup();
      await user.click(screen.getByRole('radio', { name: '遠端工作' }));
      await rename(user, '遠端工作', '在家上班');
      succeedRename(0, rerender, all);
      await rename(user, '薪水高', '高薪');
      succeedRename(1, rerender, all);
      expect(screen.getByRole('radio', { name: '高薪' })).not.toBeChecked();
      expect(screen.getByRole('radio', { name: '在家上班' })).toBeChecked();
      await user.click(screen.getByRole('button', { name: '確認' }));
      expect(onConfirm).toHaveBeenCalledWith('在家上班');
    });

    it('lets a second chip take the name the first one just released (9.7)', async () => {
      queryState.current = { data: [...SERVER, { reason: '薪水高', job_count: 1 }] };
      const { user, rerender, all, onConfirm } = setup();
      await rename(user, '遠端工作', '在家上班');
      succeedRename(0, rerender, all);
      await user.click(screen.getByRole('radio', { name: '薪水高' }));
      await rename(user, '薪水高', '遠端工作');
      expect(renameMutate).toHaveBeenCalledTimes(2);
      succeedRename(1, rerender, all);
      expect(screen.queryByRole('radio', { name: '薪水高' })).not.toBeInTheDocument();
      expect(screen.getByRole('radio', { name: '遠端工作' })).toBeChecked();
      expect(screen.getByTestId('reason-count-遠端工作')).toHaveTextContent('1');
      await user.click(screen.getByRole('button', { name: '確認' }));
      expect(onConfirm).toHaveBeenCalledWith('遠端工作');
    });

    it('keeps another selection when a different item is renamed', async () => {
      const { user, rerender, all } = setup();
      await rename(user, '遠端工作', '在家上班');
      act(() => renameMutate.mock.calls[0][1]?.onSuccess?.());
      queryState.current = { data: [SERVER[0], { reason: '在家上班', job_count: 3 }] };
      rerender(<JobPreferenceReasonDialog {...all} />);
      expect(screen.getByRole('radio', { name: '未分類' })).toBeChecked();
    });

    it('updates memory and the filter store only when they held the old name (9.8)', async () => {
      memory.read.mockReturnValue('遠端工作');
      useJobFilterStore.getState().setPreferenceReason('遠端工作');
      const { user } = setup({ preference: 'dislike' });
      await rename(user, '遠端工作', '在家上班');
      act(() => renameMutate.mock.calls[0][1]?.onSuccess?.());
      expect(memory.read).toHaveBeenCalledWith('dislike');
      expect(memory.remember).toHaveBeenCalledWith('dislike', '在家上班');
      expect(useJobFilterStore.getState().preferenceReason).toBe('在家上班');
    });

    it('leaves memory and the filter store alone when they held other names (9.8)', async () => {
      memory.read.mockReturnValue('未分類');
      useJobFilterStore.getState().setPreferenceReason('未分類');
      const { user } = setup();
      await rename(user, '遠端工作', '在家上班');
      act(() => renameMutate.mock.calls[0][1]?.onSuccess?.());
      expect(memory.remember).not.toHaveBeenCalled();
      expect(useJobFilterStore.getState().preferenceReason).toBe('未分類');
    });

    it('shows 已有同名分類 when the server answers 409 (9.5)', async () => {
      const { user } = setup();
      await rename(user, '遠端工作', '在家上班');
      act(() => renameMutate.mock.calls[0][1]?.onError?.({ response: { status: 409 } }));
      expect(screen.getByText('已有同名分類')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: '新名稱' })).toBeInTheDocument();
    });

    it('shows 改名失敗 on other errors and keeps the old name (9.9)', async () => {
      const { user } = setup();
      await rename(user, '遠端工作', '在家上班');
      act(() => renameMutate.mock.calls[0][1]?.onError?.(new Error('boom')));
      expect(screen.getByText('改名失敗')).toBeInTheDocument();
      expect(memory.remember).not.toHaveBeenCalled();
    });

    it('Esc while renaming only cancels the rename (9.10)', async () => {
      const { user, onCancel } = setup();
      await user.click(screen.getByRole('button', { name: '改名「遠端工作」' }));
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('textbox', { name: '新名稱' })).not.toBeInTheDocument();
      expect(screen.getByRole('radio', { name: '遠端工作' })).toBeInTheDocument();
      expect(onCancel).not.toHaveBeenCalled();
      await user.keyboard('{Escape}');
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });
});
