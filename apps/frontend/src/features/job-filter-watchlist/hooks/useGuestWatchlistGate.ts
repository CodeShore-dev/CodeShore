import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useIsAuthenticated } from '../../auth/authStore';
import { setReturnUrl } from '../../auth/returnUrl';

export interface UseGuestWatchlistGateOptions {
  // Opt-in: open the prompt automatically when a guest mounts this hook
  // (requirement 7.1's "直接進入關注清單頁面" case). Defaults to false so a
  // click-only caller (e.g. JobFilterFollowButton, requirement 1.4) never
  // sees an unsolicited prompt just from mounting. Only
  // JobFilterWatchlistPage (task 4.2) passes `true`.
  guardMountForGuest?: boolean;
}

export interface UseGuestWatchlistGateResult {
  // Whether the "please log in to continue" prompt is currently shown.
  promptOpen: boolean;
  // Wraps a protected action: runs it immediately when authenticated;
  // otherwise skips the action and opens the prompt instead.
  requestAction: (action: () => void) => void;
  // User confirmed the prompt: remember the current location and navigate
  // to /login. Does not replay the action that triggered the prompt
  // (requirement 1.4).
  confirmLogin: () => void;
  // User dismissed the prompt: close it.
  cancelPrompt: () => void;
}

// Unified gate for guest-triggered watchlist interactions (requirements 1.4,
// 7.1): covers both the "follow this filter" click via requestAction and a
// guest landing directly on the watchlist page via the mount effect below
// (opt-in via `guardMountForGuest`).
//
// Deliberately an independent reimplementation of the pattern in
// `useGuestPreferenceGate` (apps/frontend/src/features/job/hooks) rather
// than a shared abstraction -- see research.md 2.4 for why this feature's
// gate does not reuse or generalize that one.
export function useGuestWatchlistGate(
  options: UseGuestWatchlistGateOptions = {},
): UseGuestWatchlistGateResult {
  const { guardMountForGuest = false } = options;
  const [promptOpen, setPromptOpen] = useState(false);
  const isAuthenticated = useIsAuthenticated();
  const location = useLocation();
  const navigate = useNavigate();

  // Covers a guest landing directly on the watchlist page (requirement
  // 7.1), opt-in via `guardMountForGuest` so click-only callers (e.g.
  // JobFilterFollowButton, requirement 1.4) never see an unsolicited
  // prompt just from mounting. When enabled, this hook is only ever
  // mounted from the watchlist page (task 4.2), so the mount itself is the
  // "landing on the page" signal -- reacting to the guest's auth state at
  // mount time (and whenever it changes) is sufficient. Unlike
  // useGuestPreferenceGate, there is no page-specific URL/store state to
  // key off here.
  useEffect(() => {
    if (guardMountForGuest && !isAuthenticated) {
      setPromptOpen(true);
    }
  }, [guardMountForGuest, isAuthenticated]);

  const requestAction = (action: () => void): void => {
    if (isAuthenticated) {
      action();
      return;
    }
    // Deliberately do not retain `action` anywhere: it must not be
    // replayable after a later login (requirement 1.4).
    setPromptOpen(true);
  };

  const confirmLogin = (): void => {
    setPromptOpen(false);
    setReturnUrl(`${location.pathname}${location.search}`);
    navigate('/login');
  };

  const cancelPrompt = (): void => {
    setPromptOpen(false);
  };

  return { promptOpen, requestAction, confirmLogin, cancelPrompt };
}
