import { useEffect, useState } from 'react';

import {
  useBulkApproveSuggestionsMutation,
  useBulkRejectSuggestionsMutation,
} from './mutations';

// Multi-select checkbox state for the review page's bulk approve/reject
// action bar. Extracted out of `AiSuggestionReviewPage` to keep it under
// this repo's 200-line `max-lines` limit -- same rationale as
// `useGenerateSuggestions`.
//
// Selection is pruned to whatever is currently pending-and-in-view whenever
// `selectableIds` changes (filter change, refetch after an action, a
// suggestion leaving pending status) so a stale id can never be bulk-acted
// on again.
export function useSuggestionSelection(selectableIds: string[]) {
  const bulkApproveMutation = useBulkApproveSuggestionsMutation();
  const bulkRejectMutation = useBulkRejectSuggestionsMutation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedIds(prev => {
      const next = new Set([...prev].filter(id => selectableIds.includes(id)));
      return next.size === prev.size ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectableIds.join(',')]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev =>
      prev.size === selectableIds.length ? new Set() : new Set(selectableIds),
    );
  };

  // Surfaces a partial-failure warning (e.g. someone else already reviewed
  // one of the selected ids, so its approve/reject call 409'd) since
  // `Promise.allSettled` deliberately lets the rest succeed instead of
  // throwing -- without this, a partial failure would look identical to
  // full success (the failed rows just silently reappear after the list
  // refetches). Cleared on the next bulk action or explicitly via dismiss.
  const [partialFailure, setPartialFailure] = useState<{
    action: 'approve' | 'reject';
    failed: number;
  } | null>(null);

  const bulkApprove = () => {
    setPartialFailure(null);
    bulkApproveMutation.mutate(Array.from(selectedIds), {
      onSuccess: ({ failed }) => {
        setSelectedIds(new Set());
        if (failed > 0) setPartialFailure({ action: 'approve', failed });
      },
    });
  };

  const bulkReject = () => {
    setPartialFailure(null);
    bulkRejectMutation.mutate(Array.from(selectedIds), {
      onSuccess: ({ failed }) => {
        setSelectedIds(new Set());
        if (failed > 0) setPartialFailure({ action: 'reject', failed });
      },
    });
  };

  return {
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    bulkApprove,
    bulkReject,
    approving: bulkApproveMutation.isPending,
    rejecting: bulkRejectMutation.isPending,
    partialFailure,
    dismissPartialFailure: () => setPartialFailure(null),
  };
}
