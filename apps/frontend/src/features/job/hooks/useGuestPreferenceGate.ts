import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useIsAuthenticated } from '../../auth/authStore';
import { setReturnUrl } from '../../auth/returnUrl';
import { useJobFilterStore } from '../jobFilterStore';

export interface UseGuestPreferenceGateResult {
  // Whether the "please log in to continue" prompt is currently shown.
  promptOpen: boolean;
  // Wraps a protected action: runs it immediately when authenticated;
  // otherwise skips the action and opens the prompt instead.
  requestPreference: (action: () => void) => void;
  // User confirmed the prompt: remember the current location and navigate
  // to /login. Does not replay the action that triggered the prompt
  // (requirement 4.2).
  confirmLogin: () => void;
  // User dismissed the prompt: close it, reverting listViewPreference back
  // to null if that is what triggered the prompt (requirements 2.3, 3.3).
  cancelPrompt: () => void;
}

// Unified gate for guest-triggered job preference interactions (requirements
// 2, 3, 4.2). Covers both explicit like/dislike clicks and tab-switch clicks
// via requestPreference, and direct-URL entry into the like/dislike list
// state via the listViewPreference effect below.
export function useGuestPreferenceGate(): UseGuestPreferenceGateResult {
  const [promptOpen, setPromptOpen] = useState(false);
  const isAuthenticated = useIsAuthenticated();
  const listViewPreference = useJobFilterStore(s => s.listViewPreference);
  const setListViewPreference = useJobFilterStore(
    s => s.setListViewPreference,
  );
  const location = useLocation();
  const navigate = useNavigate();

  // Covers a guest landing directly on a URL that already encodes
  // tab=like/dislike (requirement 3.4): react to the resulting store state
  // rather than only to clicks.
  useEffect(() => {
    if (!isAuthenticated && listViewPreference !== null) {
      setPromptOpen(true);
    }
  }, [isAuthenticated, listViewPreference]);

  // Stable across renders (only changes with isAuthenticated) so it can be
  // passed down as a prop to memoized list rows without busting their memo.
  const requestPreference = useCallback(
    (action: () => void): void => {
      if (isAuthenticated) {
        action();
        return;
      }
      // Deliberately do not retain `action` anywhere: it must not be
      // replayable after a later login (requirement 4.2).
      setPromptOpen(true);
    },
    [isAuthenticated],
  );

  const confirmLogin = (): void => {
    setPromptOpen(false);
    setReturnUrl(`${location.pathname}${location.search}`);
    navigate('/login');
  };

  const cancelPrompt = (): void => {
    setPromptOpen(false);
    if (listViewPreference !== null) {
      setListViewPreference(null);
    }
  };

  return { promptOpen, requestPreference, confirmLogin, cancelPrompt };
}
