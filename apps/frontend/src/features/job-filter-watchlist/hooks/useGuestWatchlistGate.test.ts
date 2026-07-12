import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../../auth/authStore';
import { useGuestWatchlistGate } from './useGuestWatchlistGate';

let lastLocation: { pathname: string; search: string } | null = null;

function LocationSpy() {
  const location = useLocation();
  lastLocation = { pathname: location.pathname, search: location.search };
  return null;
}

// Built with createElement (not JSX) because this spec's file name is
// mandated as .ts, and esbuild only enables JSX parsing for .tsx files.
function makeWrapper(initialEntry: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      MemoryRouter,
      { initialEntries: [initialEntry] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: '*', element: children }),
      ),
      createElement(LocationSpy),
    );
  };
}

beforeEach(() => {
  useAuthStore.setState({ user: null, isLoading: false });
  lastLocation = null;
});

describe('useGuestWatchlistGate', () => {
  it('runs the action immediately with no prompt when authenticated (req 1.4)', () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'a@b.com' } as never,
      isLoading: false,
    });
    const action = vi.fn();
    const { result } = renderHook(() => useGuestWatchlistGate(), {
      wrapper: makeWrapper('/jobs/watchlist'),
    });

    act(() => result.current.requestAction(action));

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.promptOpen).toBe(false);
  });

  it('opens the prompt without running the action when unauthenticated (req 1.4)', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useGuestWatchlistGate(), {
      wrapper: makeWrapper('/jobs'),
    });

    act(() => result.current.requestAction(action));

    expect(action).not.toHaveBeenCalled();
    expect(result.current.promptOpen).toBe(true);
  });

  it('opens the prompt automatically when a guest mounts the hook with guardMountForGuest, without any requestAction call (req 7.1)', () => {
    const { result } = renderHook(
      () => useGuestWatchlistGate({ guardMountForGuest: true }),
      {
        wrapper: makeWrapper('/jobs/watchlist'),
      },
    );

    expect(result.current.promptOpen).toBe(true);
  });

  it('does not open the prompt automatically when authenticated, even with guardMountForGuest', () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'a@b.com' } as never,
      isLoading: false,
    });
    const { result } = renderHook(
      () => useGuestWatchlistGate({ guardMountForGuest: true }),
      {
        wrapper: makeWrapper('/jobs/watchlist'),
      },
    );

    expect(result.current.promptOpen).toBe(false);
  });

  it('does not open the prompt automatically for a guest when guardMountForGuest is omitted, {}, or false (req 1.4 click-only callers)', () => {
    const noOptions = renderHook(() => useGuestWatchlistGate(), {
      wrapper: makeWrapper('/jobs'),
    });
    expect(noOptions.result.current.promptOpen).toBe(false);

    const emptyOptions = renderHook(() => useGuestWatchlistGate({}), {
      wrapper: makeWrapper('/jobs'),
    });
    expect(emptyOptions.result.current.promptOpen).toBe(false);

    const explicitFalse = renderHook(
      () => useGuestWatchlistGate({ guardMountForGuest: false }),
      { wrapper: makeWrapper('/jobs') },
    );
    expect(explicitFalse.result.current.promptOpen).toBe(false);
  });

  it('confirmLogin stores the current location and navigates to /login without retaining the action', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useGuestWatchlistGate(), {
      wrapper: makeWrapper('/jobs/watchlist?tab=recent'),
    });

    act(() => result.current.requestAction(action));
    expect(result.current.promptOpen).toBe(true);

    act(() => result.current.confirmLogin());

    expect(result.current.promptOpen).toBe(false);
    expect(lastLocation?.pathname).toBe('/login');
    expect(sessionStorage.getItem('auth.returnUrl')).toBe(
      '/jobs/watchlist?tab=recent',
    );
    // The action must not be replayed at any point during/after confirm.
    expect(action).not.toHaveBeenCalled();
  });

  it('cancelPrompt closes the prompt', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useGuestWatchlistGate(), {
      wrapper: makeWrapper('/jobs/watchlist'),
    });

    act(() => result.current.requestAction(action));
    expect(result.current.promptOpen).toBe(true);

    act(() => result.current.cancelPrompt());

    expect(result.current.promptOpen).toBe(false);
  });
});
