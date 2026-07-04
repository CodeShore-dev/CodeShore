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

  it('does not commit when the gesture is a vertical scroll', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useSwipeCard({
        canLike: () => true,
        canDislike: () => true,
        onCommit,
      }),
    );

    const pointerId = 1;
    const down = {
      pointerType: 'touch',
      pointerId,
      clientX: 200,
      clientY: 100,
    } as unknown as Parameters<
      typeof result.current.handlers.onPointerDown
    >[0];
    act(() => result.current.handlers.onPointerDown(down));

    // Mostly-vertical movement (a page scroll), with only a small,
    // incidental horizontal drift from a naturally curved thumb swipe.
    const move = {
      pointerType: 'touch',
      pointerId,
      clientX: 210,
      clientY: 400,
      preventDefault: vi.fn(),
    } as unknown as Parameters<typeof result.current.handlers.onPointerMove>[0];
    act(() => result.current.handlers.onPointerMove(move));

    // Continue scrolling further down and further off-axis; since the
    // gesture already locked to 'vertical' it must stay released even if
    // the cumulative horizontal drift would otherwise cross the threshold.
    const moveFurther = {
      pointerType: 'touch',
      pointerId,
      clientX: 330,
      clientY: 700,
      preventDefault: vi.fn(),
    } as unknown as Parameters<typeof result.current.handlers.onPointerMove>[0];
    act(() => result.current.handlers.onPointerMove(moveFurther));

    const up = {
      pointerType: 'touch',
      pointerId,
      clientX: 330,
      clientY: 700,
    } as unknown as Parameters<typeof result.current.handlers.onPointerUp>[0];
    act(() => result.current.handlers.onPointerUp(up));

    expect(onCommit).not.toHaveBeenCalled();
    expect(result.current.flying).toBeNull();
  });
});
