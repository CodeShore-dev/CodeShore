import { useCallback, useRef, useState } from 'react';

import { useChangeReasonMutation, usePreferenceMutation } from '../mutations';
import { useLastReasonMemory } from './useLastReasonMemory';

export interface ReasonPickerRequest {
  jobId: string;
  preference: 'like' | 'dislike';
  // 'mark' (default): the original like/dislike-then-pick-a-reason flow.
  // 'change': edit the reason of an already-marked job without touching its
  // preference (requirement 8.2).
  mode?: 'mark' | 'change';
  // Preselected value in 'change' mode -- the job's current reason.
  currentReason?: string | null;
  // Runs after the user confirms and before the mutation fires. 'mark' mode
  // only (requirement 8.8 keeps 'change' mode free of this side effect).
  beforeCommit?: () => void;
}

export interface UseReasonPickerFlowResult {
  // null when the dialog is closed.
  pending: {
    preference: 'like' | 'dislike';
    mode: 'mark' | 'change';
    initialReason: string | null;
  } | null;
  request: (req: ReasonPickerRequest) => void;
  confirm: (reason: string) => void;
  cancel: () => void;
  // Which write failed most recently; null when neither is in error
  // (requirement 8.7).
  mutationError: 'mark' | 'change' | null;
}

// Every marking entry point (list buttons, drawer, swipe card) goes through
// this flow: nothing is written until the user confirms a reason in the
// dialog (requirement 2.1), and closing the dialog discards the request
// (requirement 2.5). The same flow also drives the "change reason" entry
// points (requirement 8.2) via `mode: 'change'`.
export function useReasonPickerFlow(): UseReasonPickerFlowResult {
  const memory = useLastReasonMemory();
  const preferenceMutation = usePreferenceMutation();
  const changeReasonMutation = useChangeReasonMutation();
  const { mutate } = preferenceMutation;
  const { mutate: changeMutate } = changeReasonMutation;

  const [pending, setPending] = useState<UseReasonPickerFlowResult['pending']>(null);
  // The full request (jobId, mode, beforeCommit) lives in a ref so `confirm`
  // can read the latest one without depending on render state, keeping the
  // callbacks stable for memoized rows.
  const requestRef = useRef<ReasonPickerRequest | null>(null);
  // Tracks which mutation ran most recently, so that if both the mark and
  // the change mutation end up in an error state at once, `mutationError`
  // reports the one the user is actually waiting on (requirement 8.7).
  const lastMutationModeRef = useRef<'mark' | 'change'>('mark');

  const request = useCallback(
    (req: ReasonPickerRequest) => {
      // A new request while one is pending replaces it: only one dialog can
      // be open, and the latest press reflects the user's current intent.
      // The replaced request is dropped without side effects, like a cancel.
      requestRef.current = req;
      const mode = req.mode ?? 'mark';
      // 'change' mode preselects the job's current reason (requirement 8.2);
      // 'mark' mode preselects the last remembered reason (requirement 6.2).
      // Both may be null; the dialog applies the default fallback
      // (requirement 6.4).
      const initialReason = mode === 'change' ? (req.currentReason ?? null) : memory.read(req.preference);
      setPending({ preference: req.preference, mode, initialReason });
    },
    [memory],
  );

  const cancel = useCallback(() => {
    requestRef.current = null;
    setPending(null);
  }, []);

  const confirm = useCallback(
    (reason: string) => {
      const req = requestRef.current;
      if (!req) return;
      requestRef.current = null;
      const mode = req.mode ?? 'mark';

      if (mode === 'change') {
        // Only the reason changes: no memory write and no beforeCommit
        // (requirement 8.8), and the preference mutation is not involved.
        lastMutationModeRef.current = 'change';
        changeMutate({ id: req.jobId, preference: req.preference, reason });
      } else {
        // Remember at confirmation time, without waiting for the server
        // (requirement 6.1).
        memory.remember(req.preference, reason);
        req.beforeCommit?.();
        lastMutationModeRef.current = 'mark';
        mutate({ id: req.jobId, preference: req.preference, reason });
      }
      setPending(null);
    },
    [memory, mutate, changeMutate],
  );

  let mutationError: 'mark' | 'change' | null = null;
  if (preferenceMutation.isError && changeReasonMutation.isError) {
    mutationError = lastMutationModeRef.current;
  } else if (changeReasonMutation.isError) {
    mutationError = 'change';
  } else if (preferenceMutation.isError) {
    mutationError = 'mark';
  }

  return {
    pending,
    request,
    confirm,
    cancel,
    mutationError,
  };
}
