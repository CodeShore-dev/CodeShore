import { useCallback, useEffect, useRef } from 'react';

import { SupabaseView } from '@codeshore/data-types';

import type { ReasonPickerRequest } from './useReasonPickerFlow';

// Returns a stable handler that opens the reason dialog in change mode for a
// job already on the like/dislike tab, preselecting its current reason (8.2).
// Jobs are read through a ref, so a refetch does not create a new handler and
// re-render every memoized row.
export function useChangeReasonHandler(
  jobs: SupabaseView.MvJob[],
  listViewPreference: 'like' | 'dislike' | null,
  onGuardPreference: (action: () => void) => void,
  request: (req: ReasonPickerRequest) => void,
): (jobId: string) => void {
  const jobsRef = useRef(jobs);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  return useCallback(
    (jobId: string) => {
      if (listViewPreference === null) return;
      const currentReason =
        jobsRef.current.find(job => job.id === jobId)?.preference_reason ?? null;
      onGuardPreference(() =>
        request({ jobId, preference: listViewPreference, mode: 'change', currentReason }),
      );
    },
    [listViewPreference, onGuardPreference, request],
  );
}
