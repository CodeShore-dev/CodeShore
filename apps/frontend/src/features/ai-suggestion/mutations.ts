import { useMutation, useQueryClient } from '@tanstack/react-query';

import { approveSuggestion, rejectSuggestion, updateLlmSettings } from './service';

// Approves a suggestion, optionally landing a reviewer-edited payload instead
// of the originally generated one (requirement 7.4). On success, invalidates
// every cached suggestion list so the now-approved suggestion disappears from
// the pending view (requirement 7.3) and invalidates its own detail query
// (its status/reviewed_by/reviewed_at just changed server-side).
export function useApproveSuggestionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      editedPayload,
    }: {
      id: string;
      editedPayload?: Record<string, unknown>;
    }) => approveSuggestion(id, editedPayload),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['ai-suggestion', 'list'] });
      queryClient.invalidateQueries({
        queryKey: ['ai-suggestion', 'detail', id],
      });
    },
  });
}

// Rejects a suggestion, optionally recording a reviewer note (requirement
// 7.3). Same invalidation as approve: the rejected suggestion disappears from
// the pending list.
export function useRejectSuggestionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      rejectSuggestion(id, note),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['ai-suggestion', 'list'] });
      queryClient.invalidateQueries({
        queryKey: ['ai-suggestion', 'detail', id],
      });
    },
  });
}

export interface BulkActionResult {
  succeeded: number;
  failed: number;
}

// Bulk approve/reject for the review page's multi-select checkboxes. There is
// no dedicated backend batch endpoint -- each id still goes through the same
// per-suggestion `PATCH .../approve|reject` route as the single-suggestion
// actions, fired concurrently. `allSettled` (not `all`) so one id's failure
// (e.g. a 409 because someone else already reviewed it) doesn't discard the
// other successes; the mutation resolves with a succeeded/failed count
// instead of throwing, and the caller decides how to surface partial
// failures.
export function useBulkApproveSuggestionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]): Promise<BulkActionResult> => {
      const results = await Promise.allSettled(
        ids.map(id => approveSuggestion(id)),
      );
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      return { succeeded, failed: results.length - succeeded };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-suggestion', 'list'] });
    },
  });
}

// Bulk reject -- the multi-select "刪除選取" action. This intentionally
// reuses reject (a status transition, never landing a write, kept for
// requirement 10.2's audit history) rather than a hard delete, so bulk
// removal from the pending queue stays consistent with the single-suggestion
// 駁回 action and the audit trail it requires.
export function useBulkRejectSuggestionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]): Promise<BulkActionResult> => {
      const results = await Promise.allSettled(
        ids.map(id => rejectSuggestion(id)),
      );
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      return { succeeded, failed: results.length - succeeded };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-suggestion', 'list'] });
    },
  });
}

// Changes the backend-adjustable default LLM model (`PATCH
// ai-suggestion/llm-settings`) -- the "後台可以調整預設值" requirement. On
// success, invalidates the llm-settings query so the displayed default
// reflects the change immediately.
export function useUpdateLlmSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (defaultModel: string) => updateLlmSettings(defaultModel),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['ai-suggestion', 'llm-settings'],
      });
    },
  });
}
