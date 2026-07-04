import { useState } from 'react';

// Tuned (task 5.1) so the fly-out stamp's own entrance transition (scale +
// fade, ~300ms in JobSwipeCard) has time to fully play before onCommit fires
// and the stamp unmounts. Previously 250ms, which could clip the animation.
const DEFAULT_HOLD_MS = 400;

export interface UsePreferenceCommitFeedbackOptions {
  onCommit: (preference: 'like' | 'dislike') => void;
  holdMs?: number;
}

export interface UsePreferenceCommitFeedbackResult {
  commit: (preference: 'like' | 'dislike') => void;
  flying: 'like' | 'dislike' | null;
}

// Generalized "mark then briefly show feedback" state machine, extracted
// from useSwipeCard so it can be reused and verified independently of the
// drag-gesture logic. commit(preference) sets `flying` immediately, then
// after `holdMs` calls onCommit and clears `flying` back to null.
export function usePreferenceCommitFeedback(
  options: UsePreferenceCommitFeedbackOptions,
): UsePreferenceCommitFeedbackResult {
  const [flying, setFlying] = useState<'like' | 'dislike' | null>(null);
  const holdMs = options.holdMs ?? DEFAULT_HOLD_MS;

  const commit = (preference: 'like' | 'dislike') => {
    setFlying(preference);
    setTimeout(() => {
      options.onCommit(preference);
      setFlying(null);
    }, holdMs);
  };

  return {
    commit,
    flying,
  };
}
