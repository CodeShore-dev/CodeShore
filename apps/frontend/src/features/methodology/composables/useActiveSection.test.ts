import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useActiveSection } from './useActiveSection';

type ObserveCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;

let capturedCallback: ObserveCallback | null = null;
let observedTargets: Element[] = [];
let realIntersectionObserver: typeof IntersectionObserver;

class MockIntersectionObserver {
  constructor(callback: ObserveCallback) {
    capturedCallback = callback;
  }
  observe(target: Element) {
    observedTargets.push(target);
  }
  unobserve = () => undefined;
  disconnect() {
    observedTargets = [];
  }
  takeRecords() {
    return [];
  }
}

beforeEach(() => {
  capturedCallback = null;
  observedTargets = [];
  realIntersectionObserver = window.IntersectionObserver;
  window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

  document.body.innerHTML = `
    <div id="one"></div>
    <div id="two"></div>
  `;
});

afterEach(() => {
  window.IntersectionObserver = realIntersectionObserver;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('useActiveSection', () => {
  it('defaults to the first id before any intersection fires', () => {
    const { result } = renderHook(() => useActiveSection(['one', 'two']));
    expect(result.current).toBe('one');
  });

  it('observes every element that exists in the DOM for the given ids', () => {
    renderHook(() => useActiveSection(['one', 'two']));
    expect(observedTargets.map(el => el.id)).toEqual(['one', 'two']);
  });

  it('switches to the id whose entry becomes intersecting', () => {
    const { result } = renderHook(() => useActiveSection(['one', 'two']));

    const two = document.getElementById('two') as Element;
    act(() => {
      capturedCallback?.([
        { isIntersecting: true, boundingClientRect: { top: 10 } as DOMRect, target: two },
      ]);
    });

    expect(result.current).toBe('two');
  });

  it('picks the topmost intersecting entry when several intersect at once', () => {
    const { result } = renderHook(() => useActiveSection(['one', 'two']));

    const one = document.getElementById('one') as Element;
    const two = document.getElementById('two') as Element;
    act(() => {
      capturedCallback?.([
        { isIntersecting: true, boundingClientRect: { top: 200 } as DOMRect, target: two },
        { isIntersecting: true, boundingClientRect: { top: 5 } as DOMRect, target: one },
      ]);
    });

    expect(result.current).toBe('one');
  });

  it('ignores non-intersecting entries', () => {
    const { result } = renderHook(() => useActiveSection(['one', 'two']));

    const two = document.getElementById('two') as Element;
    act(() => {
      capturedCallback?.([
        { isIntersecting: false, boundingClientRect: { top: 10 } as DOMRect, target: two },
      ]);
    });

    expect(result.current).toBe('one');
  });
});
