import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useReasonPickerFlow } from './useReasonPickerFlow';

const calls: string[] = [];
const mutate = vi.fn((vars: unknown) => {
  calls.push('mutate');
  return vars;
});
const changeMutate = vi.fn((vars: unknown) => {
  calls.push('changeMutate');
  return vars;
});
const remember = vi.fn((preference: string, reason: string) => {
  calls.push('remember');
  return [preference, reason];
});
const read = vi.fn((preference: 'like' | 'dislike') => (preference === 'like' ? '想投遞' : null));
let isError = false;
let changeIsError = false;

vi.mock('../mutations', () => ({
  usePreferenceMutation: () => ({ mutate, isError }),
  useChangeReasonMutation: () => ({ mutate: changeMutate, isError: changeIsError }),
}));

// The real useLastReasonMemory returns a module-level singleton, so the
// mock keeps the same identity across renders.
const memory = { read, remember };
vi.mock('./useLastReasonMemory', () => ({
  useLastReasonMemory: () => memory,
}));

beforeEach(() => {
  calls.length = 0;
  mutate.mockClear();
  changeMutate.mockClear();
  remember.mockClear();
  read.mockClear();
  isError = false;
  changeIsError = false;
});

describe('useReasonPickerFlow', () => {
  it('starts closed', () => {
    const { result } = renderHook(() => useReasonPickerFlow());
    expect(result.current.pending).toBeNull();
    expect(result.current.mutationError).toBeNull();
  });

  it('request() opens with the remembered reason for that preference (6.2)', () => {
    const { result } = renderHook(() => useReasonPickerFlow());

    act(() => result.current.request({ jobId: 'j1', preference: 'like' }));
    expect(read).toHaveBeenCalledWith('like');
    expect(result.current.pending).toEqual({
      preference: 'like',
      mode: 'mark',
      initialReason: '想投遞',
    });
  });

  it('request() leaves initialReason null when nothing is remembered', () => {
    const { result } = renderHook(() => useReasonPickerFlow());

    act(() => result.current.request({ jobId: 'j1', preference: 'dislike' }));
    expect(read).toHaveBeenCalledWith('dislike');
    expect(result.current.pending).toEqual({
      preference: 'dislike',
      mode: 'mark',
      initialReason: null,
    });
  });

  it('request() does not write anything before confirmation (2.1)', () => {
    const beforeCommit = vi.fn();
    const { result } = renderHook(() => useReasonPickerFlow());

    act(() => result.current.request({ jobId: 'j1', preference: 'like', beforeCommit }));
    expect(mutate).not.toHaveBeenCalled();
    expect(remember).not.toHaveBeenCalled();
    expect(beforeCommit).not.toHaveBeenCalled();
  });

  it('cancel() closes without API call, memory write, or beforeCommit (2.5)', () => {
    const beforeCommit = vi.fn();
    const { result } = renderHook(() => useReasonPickerFlow());

    act(() => result.current.request({ jobId: 'j1', preference: 'like', beforeCommit }));
    act(() => result.current.cancel());

    expect(result.current.pending).toBeNull();
    expect(mutate).not.toHaveBeenCalled();
    expect(remember).not.toHaveBeenCalled();
    expect(beforeCommit).not.toHaveBeenCalled();

    // A later confirm must not resurrect the cancelled request.
    act(() => result.current.confirm('想投遞'));
    expect(mutate).not.toHaveBeenCalled();
  });

  it('confirm() remembers, runs beforeCommit, mutates, then closes (2.4, 6.1)', () => {
    const beforeCommit = vi.fn(() => {
      calls.push('beforeCommit');
    });
    const { result } = renderHook(() => useReasonPickerFlow());

    act(() =>
      result.current.request({
        jobId: 'j1',
        preference: 'dislike',
        beforeCommit,
      }),
    );
    act(() => result.current.confirm('薪資太低'));

    expect(calls).toEqual(['remember', 'beforeCommit', 'mutate']);
    expect(remember).toHaveBeenCalledWith('dislike', '薪資太低');
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith({
      id: 'j1',
      preference: 'dislike',
      reason: '薪資太低',
    });
    expect(result.current.pending).toBeNull();
  });

  it('confirm() works without beforeCommit', () => {
    const { result } = renderHook(() => useReasonPickerFlow());

    act(() => result.current.request({ jobId: 'j2', preference: 'like' }));
    act(() => result.current.confirm('未分類'));

    expect(calls).toEqual(['remember', 'mutate']);
    expect(mutate).toHaveBeenCalledWith({
      id: 'j2',
      preference: 'like',
      reason: '未分類',
    });
    expect(result.current.pending).toBeNull();
  });

  it('confirm() without a pending request is a no-op', () => {
    const { result } = renderHook(() => useReasonPickerFlow());

    act(() => result.current.confirm('未分類'));

    expect(mutate).not.toHaveBeenCalled();
    expect(remember).not.toHaveBeenCalled();
    expect(result.current.pending).toBeNull();
  });

  it('a second request() replaces the pending one', () => {
    const first = vi.fn();
    const { result } = renderHook(() => useReasonPickerFlow());

    act(() =>
      result.current.request({
        jobId: 'j1',
        preference: 'dislike',
        beforeCommit: first,
      }),
    );
    act(() => result.current.request({ jobId: 'j2', preference: 'like' }));
    expect(result.current.pending).toEqual({
      preference: 'like',
      mode: 'mark',
      initialReason: '想投遞',
    });

    act(() => result.current.confirm('想投遞'));
    expect(first).not.toHaveBeenCalled();
    expect(mutate).toHaveBeenCalledWith({
      id: 'j2',
      preference: 'like',
      reason: '想投遞',
    });
  });

  it('mutationError is "mark" when the preference mutation isError (2.8, 8.7)', () => {
    const { result, rerender } = renderHook(() => useReasonPickerFlow());
    expect(result.current.mutationError).toBeNull();

    isError = true;
    rerender();
    expect(result.current.mutationError).toBe('mark');
  });

  describe('change mode (8.2, 8.3, 8.5, 8.7, 8.8)', () => {
    it('preselects the job current reason instead of the remembered one', () => {
      const { result } = renderHook(() => useReasonPickerFlow());

      act(() =>
        result.current.request({
          jobId: 'j1',
          preference: 'like',
          mode: 'change',
          currentReason: '薪資太低',
        }),
      );

      // The remembered reason must not be consulted in change mode.
      expect(read).not.toHaveBeenCalled();
      expect(result.current.pending).toEqual({
        preference: 'like',
        mode: 'change',
        initialReason: '薪資太低',
      });
    });

    it('falls back to null when currentReason is missing', () => {
      const { result } = renderHook(() => useReasonPickerFlow());

      act(() =>
        result.current.request({
          jobId: 'j1',
          preference: 'dislike',
          mode: 'change',
        }),
      );

      expect(result.current.pending?.initialReason).toBeNull();
    });

    it('confirm() calls only the change mutation, with no memory write or beforeCommit', () => {
      const beforeCommit = vi.fn();
      const { result } = renderHook(() => useReasonPickerFlow());

      act(() =>
        result.current.request({
          jobId: 'j1',
          preference: 'like',
          mode: 'change',
          currentReason: '薪資太低',
          beforeCommit,
        }),
      );
      act(() => result.current.confirm('通勤太遠'));

      expect(calls).toEqual(['changeMutate']);
      expect(changeMutate).toHaveBeenCalledWith({
        id: 'j1',
        preference: 'like',
        reason: '通勤太遠',
      });
      expect(mutate).not.toHaveBeenCalled();
      expect(remember).not.toHaveBeenCalled();
      expect(beforeCommit).not.toHaveBeenCalled();
      expect(result.current.pending).toBeNull();
    });

    it('cancel() in change mode has no side effects', () => {
      const { result } = renderHook(() => useReasonPickerFlow());

      act(() =>
        result.current.request({
          jobId: 'j1',
          preference: 'like',
          mode: 'change',
          currentReason: '薪資太低',
        }),
      );
      act(() => result.current.cancel());

      expect(result.current.pending).toBeNull();
      expect(changeMutate).not.toHaveBeenCalled();
      expect(mutate).not.toHaveBeenCalled();
      expect(remember).not.toHaveBeenCalled();

      // A later confirm must not resurrect the cancelled request.
      act(() => result.current.confirm('通勤太遠'));
      expect(changeMutate).not.toHaveBeenCalled();
    });

    it('mutationError is "change" when the change mutation isError', () => {
      const { result, rerender } = renderHook(() => useReasonPickerFlow());
      expect(result.current.mutationError).toBeNull();

      changeIsError = true;
      rerender();
      expect(result.current.mutationError).toBe('change');
    });

    it('mutationError prefers the most recently run mutation when both are in error', () => {
      const { result, rerender } = renderHook(() => useReasonPickerFlow());

      // Run a mark confirm first, then a change confirm: change ran last.
      act(() => result.current.request({ jobId: 'j1', preference: 'like' }));
      act(() => result.current.confirm('想投遞'));
      act(() =>
        result.current.request({
          jobId: 'j1',
          preference: 'like',
          mode: 'change',
          currentReason: '想投遞',
        }),
      );
      act(() => result.current.confirm('通勤太遠'));

      isError = true;
      changeIsError = true;
      rerender();
      expect(result.current.mutationError).toBe('change');
    });
  });

  it('keeps request/confirm/cancel stable across renders', () => {
    const { result, rerender } = renderHook(() => useReasonPickerFlow());
    const { request, confirm, cancel } = result.current;

    act(() => result.current.request({ jobId: 'j1', preference: 'like' }));
    rerender();

    expect(result.current.request).toBe(request);
    expect(result.current.confirm).toBe(confirm);
    expect(result.current.cancel).toBe(cancel);
  });
});
