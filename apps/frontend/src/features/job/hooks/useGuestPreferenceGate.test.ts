import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../../auth/authStore';
import { useJobFilterStore } from '../jobFilterStore';
import { useGuestPreferenceGate } from './useGuestPreferenceGate';

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
  useJobFilterStore.getState().reset();
  lastLocation = null;
});

describe('useGuestPreferenceGate', () => {
  it('runs the action immediately with no prompt when authenticated (req 2.4)', () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'a@b.com' } as never,
      isLoading: false,
    });
    const action = vi.fn();
    const { result } = renderHook(() => useGuestPreferenceGate(), {
      wrapper: makeWrapper('/jobs'),
    });

    act(() => result.current.requestPreference(action));

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.promptOpen).toBe(false);
  });

  it('opens the prompt without running the action when unauthenticated (req 2.1)', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useGuestPreferenceGate(), {
      wrapper: makeWrapper('/jobs'),
    });

    act(() => result.current.requestPreference(action));

    expect(action).not.toHaveBeenCalled();
    expect(result.current.promptOpen).toBe(true);
  });

  it('opens the prompt automatically when listViewPreference is already set for a guest (req 3.4)', () => {
    act(() => {
      useJobFilterStore.getState().setListViewPreference('like');
    });
    const { result } = renderHook(() => useGuestPreferenceGate(), {
      wrapper: makeWrapper('/jobs?tab=like'),
    });

    expect(result.current.promptOpen).toBe(true);
  });

  it('does not open the prompt automatically when authenticated even if listViewPreference is set', () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'a@b.com' } as never,
      isLoading: false,
    });
    act(() => {
      useJobFilterStore.getState().setListViewPreference('like');
    });
    const { result } = renderHook(() => useGuestPreferenceGate(), {
      wrapper: makeWrapper('/jobs?tab=like'),
    });

    expect(result.current.promptOpen).toBe(false);
  });

  it('confirmLogin stores the current location and navigates to /login without retaining the action (req 4.1, 4.2)', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useGuestPreferenceGate(), {
      wrapper: makeWrapper('/jobs?search=go'),
    });

    act(() => result.current.requestPreference(action));
    expect(result.current.promptOpen).toBe(true);

    act(() => result.current.confirmLogin());

    expect(result.current.promptOpen).toBe(false);
    expect(lastLocation?.pathname).toBe('/login');
    expect(sessionStorage.getItem('auth.returnUrl')).toBe('/jobs?search=go');
    // The action must not be replayed at any point during/after confirm.
    expect(action).not.toHaveBeenCalled();
  });

  it('cancelPrompt closes the prompt and resets listViewPreference when that triggered it (req 2.3, 3.3)', () => {
    act(() => {
      useJobFilterStore.getState().setListViewPreference('like');
    });
    const { result } = renderHook(() => useGuestPreferenceGate(), {
      wrapper: makeWrapper('/jobs?tab=like'),
    });
    expect(result.current.promptOpen).toBe(true);

    act(() => result.current.cancelPrompt());

    expect(result.current.promptOpen).toBe(false);
    expect(useJobFilterStore.getState().listViewPreference).toBeNull();
  });

  it('cancelPrompt is a no-op on listViewPreference for a click-triggered prompt', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useGuestPreferenceGate(), {
      wrapper: makeWrapper('/jobs'),
    });

    act(() => result.current.requestPreference(action));
    expect(result.current.promptOpen).toBe(true);
    expect(useJobFilterStore.getState().listViewPreference).toBeNull();

    act(() => result.current.cancelPrompt());

    expect(result.current.promptOpen).toBe(false);
    expect(useJobFilterStore.getState().listViewPreference).toBeNull();
  });
});
