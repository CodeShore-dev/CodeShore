import { useMutation, useQueryClient } from '@tanstack/react-query';

import { approveSuggestion, rejectSuggestion } from './service';

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
