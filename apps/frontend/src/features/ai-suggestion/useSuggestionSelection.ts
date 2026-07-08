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

  const bulkApprove = () => {
    bulkApproveMutation.mutate(Array.from(selectedIds), {
      onSuccess: () => setSelectedIds(new Set()),
    });
  };

  const bulkReject = () => {
    bulkRejectMutation.mutate(Array.from(selectedIds), {
      onSuccess: () => setSelectedIds(new Set()),
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
  };
}
