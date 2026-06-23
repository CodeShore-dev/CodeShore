import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useSwipeCard } from './useSwipeCard';

afterEach(() => {
  vi.useRealTimers();
});

describe('useSwipeCard', () => {
  it('commits a preference after the fly-out delay', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useSwipeCard({
        canLike: () => true,
        canDislike: () => true,
        onCommit,
      }),
    );

    act(() => result.current.commit('like'));
    expect(result.current.flying).toBe('like');
    expect(onCommit).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onCommit).toHaveBeenCalledWith('like');
  });
});
