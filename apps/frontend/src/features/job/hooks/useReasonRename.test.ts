import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useJobFilterStore } from '../jobFilterStore';
import { useReasonRename } from './useReasonRename';

type RenameOptions = { onSuccess?: () => void; onError?: (error: unknown) => void };
const renameMutate = vi.fn<
  (
    vars: { preference: 'like' | 'dislike'; reason: string; name: string },
    opts?: RenameOptions,
  ) => void
>();
const memory = { read: vi.fn<(p: 'like' | 'dislike') => string | null>(), remember: vi.fn() };

vi.mock('../mutations', () => ({
  useRenamePreferenceReasonMutation: () => ({ mutate: renameMutate, isPending: false }),
}));
vi.mock('./useLastReasonMemory', () => ({ useLastReasonMemory: () => memory }));

function setup() {
  const onRenamed = vi.fn();
  const hook = renderHook(() =>
    useReasonRename({ preference: 'like', existing: ['未分類', '遠端工作', '薪水高'], onRenamed }),
  );
  act(() => hook.result.current.start('遠端工作'));
  return { ...hook, onRenamed };
}

beforeEach(() => {
  renameMutate.mockReset();
  memory.read.mockReset().mockReturnValue(null);
  memory.remember.mockReset();
  useJobFilterStore.getState().reset();
});

describe('useReasonRename', () => {
  it('start sets renaming, cancel clears it and the error', () => {
    const { result } = setup();
    expect(result.current.renaming).toBe('遠端工作');
    act(() => result.current.rename('遠端工作', '未分類'));
    expect(result.current.renameError).toBe('duplicate');
    act(() => result.current.cancel());
    expect(result.current.renaming).toBeNull();
    expect(result.current.renameError).toBeNull();
  });

  it.each([
    ['   ', 'empty'],
    ['a'.repeat(21), 'too_long'],
  ] as const)('rejects %j with %s (9.4)', (raw, error) => {
    const { result } = setup();
    act(() => result.current.rename('遠端工作', raw));
    expect(result.current.renameError).toBe(error);
    expect(renameMutate).not.toHaveBeenCalled();
  });

  it('exits without calling the API for the same name (9.6)', () => {
    const { result } = setup();
    act(() => result.current.rename('遠端工作', ' 遠端工作 '));
    expect(result.current.renaming).toBeNull();
    expect(renameMutate).not.toHaveBeenCalled();
  });

  it('rejects an existing name (9.5)', () => {
    const { result } = setup();
    act(() => result.current.rename('遠端工作', '薪水高'));
    expect(result.current.renameError).toBe('duplicate');
    expect(renameMutate).not.toHaveBeenCalled();
  });

  it('on success exits, reports, and follows memory and filter (9.7, 9.8)', () => {
    memory.read.mockReturnValue('遠端工作');
    useJobFilterStore.getState().setPreferenceReason('遠端工作');
    const { result, onRenamed } = setup();
    act(() => result.current.rename('遠端工作', '在家上班'));
    expect(renameMutate).toHaveBeenCalledWith(
      { preference: 'like', reason: '遠端工作', name: '在家上班' },
      expect.any(Object),
    );
    act(() => renameMutate.mock.calls[0][1]?.onSuccess?.());
    expect(result.current.renaming).toBeNull();
    expect(onRenamed).toHaveBeenCalledWith('遠端工作', '在家上班');
    expect(memory.remember).toHaveBeenCalledWith('like', '在家上班');
    expect(useJobFilterStore.getState().preferenceReason).toBe('在家上班');
  });

  it('maps 409 to duplicate and other errors to failed (9.5, 9.9)', () => {
    const { result, onRenamed } = setup();
    act(() => result.current.rename('遠端工作', '在家上班'));
    act(() => renameMutate.mock.calls[0][1]?.onError?.({ response: { status: 409 } }));
    expect(result.current.renameError).toBe('duplicate');
    act(() => renameMutate.mock.calls[0][1]?.onError?.(new Error('boom')));
    expect(result.current.renameError).toBe('failed');
    expect(result.current.renaming).toBe('遠端工作');
    expect(onRenamed).not.toHaveBeenCalled();
  });
});
