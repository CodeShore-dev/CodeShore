import { useCallback, useRef, useState } from 'react';

import { usePreferenceMutation } from '../mutations';
import { useLastReasonMemory } from './useLastReasonMemory';

export interface ReasonPickerRequest {
  jobId: string;
  preference: 'like' | 'dislike';
  // Runs after the user confirms and before the mutation fires.
  beforeCommit?: () => void;
}

export interface UseReasonPickerFlowResult {
  // null when the dialog is closed.
  pending: {
    preference: 'like' | 'dislike';
    initialReason: string | null;
  } | null;
  request: (req: ReasonPickerRequest) => void;
  confirm: (reason: string) => void;
  cancel: () => void;
  mutationError: boolean;
}

// Every marking entry point (list buttons, drawer, swipe card) goes through
// this flow: nothing is written until the user confirms a reason in the
// dialog (requirement 2.1), and closing the dialog discards the request
// (requirement 2.5).
export function useReasonPickerFlow(): UseReasonPickerFlowResult {
  const memory = useLastReasonMemory();
  const preferenceMutation = usePreferenceMutation();
  const { mutate } = preferenceMutation;

  const [pending, setPending] =
    useState<UseReasonPickerFlowResult['pending']>(null);
  // The full request (jobId, beforeCommit) lives in a ref so `confirm` can
  // read the latest one without depending on render state, keeping the
  // callbacks stable for memoized rows.
  const requestRef = useRef<ReasonPickerRequest | null>(null);

  const request = useCallback(
    (req: ReasonPickerRequest) => {
      // A new request while one is pending replaces it: only one dialog can
      // be open, and the latest press reflects the user's current intent.
      // The replaced request is dropped without side effects, like a cancel.
      requestRef.current = req;
      // Preselect the last remembered reason (requirement 6.2). It may be
      // null; the dialog applies the default fallback (requirement 6.4).
      setPending({
        preference: req.preference,
        initialReason: memory.read(req.preference),
      });
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

      // Remember at confirmation time, without waiting for the server
      // (requirement 6.1).
      memory.remember(req.preference, reason);
      req.beforeCommit?.();
      mutate({ id: req.jobId, preference: req.preference, reason });
      setPending(null);
    },
    [memory, mutate],
  );

  return {
    pending,
    request,
    confirm,
    cancel,
    mutationError: preferenceMutation.isError,
  };
}
