import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useCurationStore } from './curationStore';
import { bulkExcludeKeywords, resumeSession, startSession } from './service';
import type { HumanDecision } from './service';

// Extracts a human-readable message from whatever `httpClient` rejects with
// (an Axios error, a plain Error, or anything else) for `curationStore.setError`
// (requirement 9.1: "顯示錯誤訊息，並允許管理員重試提交或略過當前 keyword").
function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

// Starts a curation session for the given keyword (POST /session,
// requirement 2.1). `onMutate` calls `curationStore`'s `startSession(keyword)`
// entry point synchronously, *before* the request resolves -- this is the ONE
// call site that should invoke it (see `curationStore.ts`'s doc comment on
// `startSession` vs. the narrower `setSessionLoading`, and its note attributing
// the call to this hook). That sets `activeKeyword` + `sessionStatus: 'loading'`
// and clears any stale `threadId`/`interrupt`/`commitResult`/`errorMessage` left
// over from a previous session, so a future page component (task 7.1) only has
// to call `mutate(keyword)` and the "analysis in progress" indicator
// (requirement 2.1, 2.2) is correct immediately, not just after the round trip.
// On success, the AI recommendation interrupt payload is stored via
// `setInterrupted` (requirement 2.1; the payload itself is rendered per
// requirement 3.1-3.5 by a later task). On failure, `setError` moves the
// session out of `loading` so the admin isn't stuck with no feedback
// (requirement 9.1/9.2 -- not this task's literal boundary, but a direct
// consequence of this hook being the one that puts the store into `loading`).
export function useStartSessionMutation() {
  return useMutation({
    mutationFn: (keyword: string) => startSession(keyword),
    onMutate: (keyword: string) => {
      useCurationStore.getState().startSession(keyword);
    },
    onSuccess: ({ threadId, interrupt }) => {
      useCurationStore.getState().setInterrupted(threadId, interrupt);
    },
    onError: (error: unknown) => {
      useCurationStore.getState().setError(toErrorMessage(error));
    },
  });
}

// Resumes an in-progress session with the admin's decision (POST
// /session/:id/resume, requirement 4.1's gate is enforced by callers only
// invoking this after an explicit path choice). Unlike
// `useStartSessionMutation`, this does NOT touch `activeKeyword`/`threadId` --
// it's the same session/thread continuing, not a new one -- so `onMutate` uses
// the narrower `setSessionLoading()` rather than `startSession()`, which would
// wrongly wipe the very `threadId` being resumed (see `curationStore.ts`'s doc
// comment). On success, the `CommitResult` is stored via `setDone` (requirement
// 5.2, 6.7, 7.2) and the keyword queue query is invalidated so the
// just-resolved keyword drops out of `useKeywordQueueQuery`'s cached list
// (requirement 5.2, 6.7, 7.2 all say the keyword must leave 待處理佇列). On
// failure, `setError` surfaces the failure per requirement 9.1/9.3 so the admin
// can retry the same threadId/decision rather than being stuck in `loading`.
export function useResumeSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      threadId,
      decision,
    }: {
      threadId: string;
      decision: HumanDecision;
    }) => resumeSession(threadId, decision),
    onMutate: () => {
      useCurationStore.getState().setSessionLoading();
    },
    onSuccess: ({ result }) => {
      useCurationStore.getState().setDone(result);
      queryClient.invalidateQueries({
        queryKey: ['keyword-curation', 'queue'],
      });
    },
    onError: (error: unknown) => {
      useCurationStore.getState().setError(toErrorMessage(error));
    },
  });
}

// Bulk-rejects the given keywords into keyword_bin (path C) in one request,
// skipping the per-keyword AI-analysis/human-decision session entirely --
// for an admin clearing several obviously-noisy keywords at once from the
// queue's multi-select toolbar. Invalidates the queue query on success so
// the bulk-excluded keywords drop out of the visible list.
export function useBulkExcludeKeywordsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keywords: string[]) => bulkExcludeKeywords(keywords),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['keyword-curation', 'queue'],
      });
    },
  });
}
