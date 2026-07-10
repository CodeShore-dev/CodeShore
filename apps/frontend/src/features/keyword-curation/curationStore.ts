import { create } from 'zustand';

import type { AiRecommendation, CommitResult } from './service';

// Session state machine for a single keyword-curation session (task 5.2).
// Mirrors design.md's `curationStore` block exactly (5 statuses: idle /
// loading / interrupted / done / error) and satisfies requirement 2.2 (show
// the in-progress keyword), 2.3 (a `loading` session lets callers guard
// against re-triggering analysis for the same keyword), 8.2 (leaving
// mid-session doesn't roll back already-committed results -- this store
// simply doesn't clear `commitResult`/`activeKeyword` on its own; only an
// explicit `reset()` or a new `startSession()` does), and 9.3 (`commitResult`
// holds the full `CommitResult`, including the `partialChanges` recorded on
// the `ok: false` branch, so the `done` view can render a committed/failed
// status badge per change).
export interface CurationStoreState {
  activeKeyword: string | null;
  sessionStatus: 'idle' | 'loading' | 'interrupted' | 'done' | 'error';
  threadId: string | null;
  interrupt: AiRecommendation | null;
  commitResult: CommitResult | null;
  errorMessage: string | null;

  startSession: (keyword: string) => void;
  setSessionLoading: () => void;
  setInterrupted: (threadId: string, interrupt: AiRecommendation) => void;
  setDone: (result: CommitResult) => void;
  setError: (message: string) => void;
  reset: () => void;
}

export const INITIAL_CURATION_STATE = {
  activeKeyword: null,
  sessionStatus: 'idle' as const,
  threadId: null,
  interrupt: null,
  commitResult: null,
  errorMessage: null,
};

export const useCurationStore = create<CurationStoreState>(set => ({
  ...INITIAL_CURATION_STATE,

  // Entry point for starting a curation session on a keyword (requirement
  // 2.1, 2.2). Also clears any leftover threadId/interrupt/commitResult/
  // errorMessage from a previous session so a `done`/`error` session's data
  // never leaks into the next one's `interrupted`/`done` render.
  startSession: keyword =>
    set({
      activeKeyword: keyword,
      sessionStatus: 'loading',
      threadId: null,
      interrupt: null,
      commitResult: null,
      errorMessage: null,
    }),

  // Narrower helper that only flips the status to `loading` without
  // touching `activeKeyword` (or clearing threadId/interrupt/commitResult).
  // `startSession` is the session *entry point* (task 5.3's
  // `useStartSessionMutation` calls it when the admin picks a keyword off
  // the queue); `setSessionLoading` is for the in-flight state of a
  // *resume* on the same keyword/thread -- e.g. `useResumeSessionMutation`
  // (task 5.3) flipping status to `loading` while a decision is submitted,
  // or a retry-after-error (requirement 9.1, 9.3) re-submitting against the
  // same `activeKeyword`/`threadId` without wanting to wipe them.
  setSessionLoading: () => set({ sessionStatus: 'loading' }),

  setInterrupted: (threadId, interrupt) =>
    set({ sessionStatus: 'interrupted', threadId, interrupt }),

  // Stores the full CommitResult, including `partialChanges` on the
  // `ok: false` branch (requirement 9.3), so the `done` view can render
  // per-change committed/failed status badges.
  setDone: result => set({ sessionStatus: 'done', commitResult: result }),

  setError: message => set({ sessionStatus: 'error', errorMessage: message }),

  reset: () => set({ ...INITIAL_CURATION_STATE }),
}));
