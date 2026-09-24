import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useReasonPickerFlow } from './useReasonPickerFlow';

const calls: string[] = [];
const mutate = vi.fn((vars: unknown) => {
  calls.push('mutate');
  return vars;
});
const remember = vi.fn((preference: string, reason: string) => {
  calls.push('remember');
  return [preference, reason];
});
const read = vi.fn((preference: 'like' | 'dislike') =>
  preference === 'like' ? '想投遞' : null,
);
let isError = false;

vi.mock('../mutations', () => ({
  usePreferenceMutation: () => ({ mutate, isError }),
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
  remember.mockClear();
  read.mockClear();
  isError = false;
});

describe('useReasonPickerFlow', () => {
  it('starts closed', () => {
    const { result } = renderHook(() => useReasonPickerFlow());
    expect(result.current.pending).toBeNull();
    expect(result.current.mutationError).toBe(false);
  });

  it('request() opens with the remembered reason for that preference (6.2)', () => {
    const { result } = renderHook(() => useReasonPickerFlow());

    act(() => result.current.request({ jobId: 'j1', preference: 'like' }));
    expect(read).toHaveBeenCalledWith('like');
    expect(result.current.pending).toEqual({
      preference: 'like',
      initialReason: '想投遞',
    });
  });

  it('request() leaves initialReason null when nothing is remembered', () => {
    const { result } = renderHook(() => useReasonPickerFlow());

    act(() => result.current.request({ jobId: 'j1', preference: 'dislike' }));
    expect(read).toHaveBeenCalledWith('dislike');
    expect(result.current.pending).toEqual({
      preference: 'dislike',
      initialReason: null,
    });
  });

  it('request() does not write anything before confirmation (2.1)', () => {
    const beforeCommit = vi.fn();
    const { result } = renderHook(() => useReasonPickerFlow());

    act(() =>
      result.current.request({ jobId: 'j1', preference: 'like', beforeCommit }),
    );
    expect(mutate).not.toHaveBeenCalled();
    expect(remember).not.toHaveBeenCalled();
    expect(beforeCommit).not.toHaveBeenCalled();
  });

  it('cancel() closes without API call, memory write, or beforeCommit (2.5)', () => {
    const beforeCommit = vi.fn();
    const { result } = renderHook(() => useReasonPickerFlow());

    act(() =>
      result.current.request({ jobId: 'j1', preference: 'like', beforeCommit }),
    );
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

  it('mutationError mirrors the preference mutation isError (2.8)', () => {
    const { result, rerender } = renderHook(() => useReasonPickerFlow());
    expect(result.current.mutationError).toBe(false);

    isError = true;
    rerender();
    expect(result.current.mutationError).toBe(true);
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
