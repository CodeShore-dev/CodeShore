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

afterEach(() => {
  cleanup();
});
