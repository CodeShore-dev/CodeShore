import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { usePreferenceCommitFeedback } from './usePreferenceCommitFeedback';

afterEach(() => {
  vi.useRealTimers();
});

describe('usePreferenceCommitFeedback', () => {
  it('sets flying immediately on commit, then calls onCommit and clears flying after the default hold (250ms)', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const { result } = renderHook(() => usePreferenceCommitFeedback({ onCommit }));

    expect(result.current.flying).toBeNull();

    act(() => result.current.commit('like'));
    expect(result.current.flying).toBe('like');
    expect(onCommit).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(249);
    });
    expect(onCommit).not.toHaveBeenCalled();
    expect(result.current.flying).toBe('like');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onCommit).toHaveBeenCalledWith('like');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(result.current.flying).toBeNull();
  });

  it('supports a configurable holdMs, calling onCommit only after that exact duration', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      usePreferenceCommitFeedback({ onCommit, holdMs: 500 }),
    );

    act(() => result.current.commit('dislike'));
    expect(result.current.flying).toBe('dislike');

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onCommit).not.toHaveBeenCalled();
    expect(result.current.flying).toBe('dislike');

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onCommit).toHaveBeenCalledWith('dislike');
    expect(result.current.flying).toBeNull();
  });

  it('does not block the caller: commit returns before the hold elapses, without awaiting it', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const { result } = renderHook(() => usePreferenceCommitFeedback({ onCommit }));

    // If commit blocked until onCommit fired, this synchronous call and the
    // immediate assertion right after it would never both be reachable
    // without advancing fake timers first.
    act(() => result.current.commit('like'));
    expect(onCommit).not.toHaveBeenCalled();
    expect(result.current.flying).toBe('like');
  });
});
