import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useIsMobile } from './useIsMobile';

function mockMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  let changeHandler: (() => void) | null = null;

  const mql = {
    get matches() {
      return matches;
    },
    media: '(max-width: 767px)',
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: (_event: string, handler: () => void) => {
      changeHandler = handler;
    },
    removeEventListener: () => {
      changeHandler = null;
    },
    dispatchEvent: () => false,
  };

  window.matchMedia = vi.fn().mockReturnValue(mql);

  return {
    setMatches: (next: boolean) => {
      matches = next;
      changeHandler?.();
    },
  };
}

describe('useIsMobile', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('returns true immediately when the mobile breakpoint already matches on mount', () => {
    mockMatchMedia(true);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it('returns false when the mobile breakpoint does not match', () => {
    mockMatchMedia(false);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  it('updates when the media query change event fires (e.g. window resize/orientation change)', () => {
    const { setMatches } = mockMatchMedia(false);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      setMatches(true);
    });

    expect(result.current).toBe(true);
  });
});
