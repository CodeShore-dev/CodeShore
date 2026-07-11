import { useRef } from 'react';

import { useCurationStore } from '../curationStore';
import { useResumeSessionMutation } from '../mutations';
import type { HumanDecision } from '../service';
import { CurationSessionDone } from './CurationSessionDone';
import { CurationSessionInterrupted } from './CurationSessionInterrupted';

interface PendingDecision {
  threadId: string;
  decision: HumanDecision;
}

// CurationSession (task 6.7, requirements 2.2, 2.3, 3.5, 8.1, 9.1-9.3): the
// top-level session state-machine view. Switches over
// curationStore.sessionStatus and renders exactly one of 5 mutually
// exclusive views (idle / loading / interrupted / done / error). Split into
// CurationSessionInterrupted.tsx (AiRecommendationCard + path-specific
// decision form + CommitPreviewPanel composition) and CurationSessionDone.tsx
// (commitResult rendering) per frontend-standards.md's 200-line-per-file
// limit.
export function CurationSession() {
  const sessionStatus = useCurationStore(s => s.sessionStatus);
  const activeKeyword = useCurationStore(s => s.activeKeyword);
  const threadId = useCurationStore(s => s.threadId);
  const interrupt = useCurationStore(s => s.interrupt);
  const commitResult = useCurationStore(s => s.commitResult);
  const errorMessage = useCurationStore(s => s.errorMessage);
  const reset = useCurationStore(s => s.reset);
  const { mutate } = useResumeSessionMutation();

  // Remembers the most recently submitted decision (thread + payload) so a
  // "重試" click after a failed resume (requirement 9.1) can re-submit the
  // exact same request. Lives on CurationSession itself (not on
  // CurationSessionInterrupted) because the interrupted sub-view unmounts as
  // soon as the resume mutation flips sessionStatus away from 'interrupted'
  // -- this ref must survive that unmount to still be readable once the
  // status reaches 'error'. If no decision was ever submitted in this
  // component's lifetime (e.g. the session errored before any interrupt was
  // even reached), "重試" falls back to resetting to `idle` so the admin can
  // restart the keyword from the queue.
  const lastDecisionRef = useRef<PendingDecision | null>(null);

  const handleSubmitDecision = (decision: HumanDecision): void => {
    if (!threadId) return;
    lastDecisionRef.current = { threadId, decision };
    mutate({ threadId, decision });
  };

  const handleRetry = (): void => {
    if (lastDecisionRef.current) {
      mutate(lastDecisionRef.current);
    } else {
      reset();
    }
  };

  if (sessionStatus === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <span className="material-symbols-outlined mb-4 text-6xl text-[#001f2a]/20">
          touch_app
        </span>
        <p className="text-sm text-[#434653]">
          請從左側選擇一個 keyword 開始策展
        </p>
      </div>
    );
  }

  if (sessionStatus === 'loading') {
    return (
      <div
        data-testid="curation-session-loading"
        className="flex flex-col items-center justify-center gap-3 p-12 text-center"
      >
        <span className="material-symbols-outlined animate-spin text-4xl text-[#003d92]">
          progress_activity
        </span>
        <p className="text-sm text-[#434653]">
          正在分析{' '}
          <span className="font-bold text-[#001f2a]">{activeKeyword}</span>
          ...
        </p>
      </div>
    );
  }

  if (sessionStatus === 'interrupted' && interrupt && activeKeyword) {
    return (
      <CurationSessionInterrupted
        interrupt={interrupt}
        activeKeyword={activeKeyword}
        onSubmitDecision={handleSubmitDecision}
      />
    );
  }

  if (sessionStatus === 'done' && commitResult) {
    return <CurationSessionDone commitResult={commitResult} onNext={reset} />;
  }

  if (sessionStatus === 'error') {
    return (
      <div className="rounded-xl border border-[#c3c6d5] bg-white p-4 shadow-[0_24px_40px_rgba(0,31,42,0.06)]">
        <p className="text-sm text-[#ba1a1a]">{errorMessage}</p>
        <button
          type="button"
          onClick={handleRetry}
          className="mt-4 w-full cursor-pointer rounded-lg bg-[#003d92] px-3 py-2 text-sm font-bold text-white transition hover:bg-[#1654b9]"
        >
          重試
        </button>
        <button
          type="button"
          onClick={reset}
          className="mt-2 w-full cursor-pointer rounded-lg border border-[#c3c6d5] bg-white px-3 py-2 text-sm font-bold text-[#434653] transition hover:bg-[#f3f4f7]"
        >
          略過此 keyword
        </button>
      </div>
    );
  }

  return null;
}
