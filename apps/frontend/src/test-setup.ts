// Vitest setup for React Testing Library (task 1.4).
// Adds jest-dom matchers (toBeInTheDocument, etc.) and clears the DOM
// between tests.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom does not implement window.scrollTo; stub it so scroll side-effects
// (ScrollManager, Pagination) are harmless no-ops in tests. Individual tests
// may still spyOn(window, 'scrollTo') to assert calls.
window.scrollTo = () => undefined;

// jsdom does not implement Element.scrollIntoView either; the job list keeps
// the selected row in view via scrollIntoView, so stub it as a no-op.
Element.prototype.scrollIntoView = () => undefined;

// jsdom does not implement IntersectionObserver (used by the methodology
// page's scrollspy nav). Default to an inert no-op; tests that need to
// assert scrollspy behavior replace this with a controllable mock.
class NoopIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observe = () => undefined;
  unobserve = () => undefined;
  disconnect = () => undefined;
  takeRecords = (): IntersectionObserverEntry[] => [];
}
window.IntersectionObserver = NoopIntersectionObserver as unknown as typeof IntersectionObserver;

// jsdom does not implement window.matchMedia (used by responsive hooks like
// location-map's useIsMobile). Default to "not matching" (desktop) so
// existing tests keep their current behavior; tests that need mobile
// behavior override this with their own mock.
window.matchMedia =
  window.matchMedia ||
  ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList);

afterEach(() => {
  cleanup();
});
