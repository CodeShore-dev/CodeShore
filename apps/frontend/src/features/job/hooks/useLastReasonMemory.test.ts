import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useLastReasonMemory } from './useLastReasonMemory';

describe('useLastReasonMemory', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns null for a preference that has never been remembered', () => {
    const { result } = renderHook(() => useLastReasonMemory());

    expect(result.current.read('like')).toBeNull();
    expect(result.current.read('dislike')).toBeNull();
  });

  it('remembers like and dislike separately', () => {
    const { result } = renderHook(() => useLastReasonMemory());

    result.current.remember('like', '技能已符合');
    result.current.remember('dislike', '地點不符');

    expect(result.current.read('like')).toBe('技能已符合');
    expect(result.current.read('dislike')).toBe('地點不符');
  });

  it('overwrites the previously remembered reason for the same preference', () => {
    const { result } = renderHook(() => useLastReasonMemory());

    result.current.remember('like', '技能已符合');
    result.current.remember('like', '差一點要補技能經驗');

    expect(result.current.read('like')).toBe('差一點要補技能經驗');
  });

  it('stores like and dislike under separate namespaced keys', () => {
    const { result } = renderHook(() => useLastReasonMemory());

    result.current.remember('like', '技能已符合');
    result.current.remember('dislike', '地點不符');

    expect(localStorage.getItem('codeshore:lastPreferenceReason:like')).toBe(
      '技能已符合',
    );
    expect(
      localStorage.getItem('codeshore:lastPreferenceReason:dislike'),
    ).toBe('地點不符');
  });

  it('read returns null when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    const { result } = renderHook(() => useLastReasonMemory());

    expect(result.current.read('like')).toBeNull();
  });

  it('remember does not throw when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    const { result } = renderHook(() => useLastReasonMemory());

    expect(() => result.current.remember('like', '技能已符合')).not.toThrow();
  });

  it('read returns null when accessing window.localStorage itself throws', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      window,
      'localStorage',
    );
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('access denied');
      },
    });

    try {
      const { result } = renderHook(() => useLastReasonMemory());
      expect(result.current.read('like')).toBeNull();
      expect(() =>
        result.current.remember('like', '技能已符合'),
      ).not.toThrow();
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(window, 'localStorage', originalDescriptor);
      }
    }
  });

  it('returns stable function references across re-renders', () => {
    const { result, rerender } = renderHook(() => useLastReasonMemory());

    const first = result.current;
    rerender();

    expect(result.current.read).toBe(first.read);
    expect(result.current.remember).toBe(first.remember);
  });
});
