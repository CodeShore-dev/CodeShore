import { useEffect, useMemo, useState } from 'react';

import type {
  AiRecommendation,
  ConfirmedEdge,
  HumanDecision,
  NewTechFields,
} from '../service';
import { AiRecommendationCard } from './AiRecommendationCard';
import { CommitPreviewPanel } from './CommitPreviewPanel';
import {
  computeInitialDecision,
  getPathBRecommendation,
  type ManualPath,
} from './curationDecisionHelpers';
import { PathADecisionForm } from './PathADecisionForm';
import { PathBDecisionForm } from './PathBDecisionForm';
import { PathCDecisionForm } from './PathCDecisionForm';

interface CurationSessionInterruptedProps {
  interrupt: AiRecommendation;
  activeKeyword: string;
  onSubmitDecision: (decision: HumanDecision) => void;
}

const MANUAL_SELECT_OPTIONS: Array<{ path: ManualPath; label: string }> = [
  { path: 'A', label: 'A · 映射既有技術' },
  { path: 'B', label: 'B · 建立新技術' },
  { path: 'C', label: 'C · 放入 keyword bin' },
];

// CurationSessionInterrupted (part of task 6.7, requirements 3.5, 4.1-4.4,
// 9.2): the `interrupted` sessionStatus view. Always shows
// AiRecommendationCard for the AI's (possibly ai_failed) recommendation.
// `selectedPath` tracks which path is currently being decided -- it
// defaults to `interrupt.path` for a real A/B/C recommendation, or `null`
// (unselected) for `ai_failed`, and is driven back to `null` by
// PathCDecisionForm's `onCancel` (requirement 4.4: cancelling path C lets
// the admin pick a different path). When `null`, either
// AiRecommendationCard's own manual-path buttons (the `ai_failed` case) or
// this component's own fallback selector (the cancel-from-a-real-C case)
// let the admin (re)pick a path.
export function CurationSessionInterrupted({
  interrupt,
  activeKeyword,
  onSubmitDecision,
}: CurationSessionInterruptedProps) {
  const [selectedPath, setSelectedPath] = useState<ManualPath | null>(
    interrupt.path === 'ai_failed' ? null : interrupt.path,
  );

  const initialDecision = useMemo(
    () => computeInitialDecision(interrupt, selectedPath, activeKeyword),
    [interrupt, selectedPath, activeKeyword],
  );

  // Live-updated mirror of the currently-active decision form's in-progress
  // state (task 6.7 fix, requirement 4.1, 5.1, 6.6: CommitPreviewPanel must
  // reflect the admin's live edits, not just the AI's static defaults).
  // Reset to the freshly recomputed AI-default whenever the active path (or
  // the underlying interrupt/keyword) changes -- a newly-mounted decision
  // form starts from its own AI-default state at that point -- and
  // thereafter kept in sync by PathADecisionForm/PathBDecisionForm's
  // `onChange` callbacks as the admin edits fields.
  const [liveDecision, setLiveDecision] = useState<HumanDecision | null>(
    initialDecision,
  );

  useEffect(() => {
    setLiveDecision(initialDecision);
  }, [initialDecision]);

  const handlePathAChange = (confirmedTechId: string): void => {
    setLiveDecision({ path: 'A', confirmedTechId });
  };

  const handlePathBChange = (payload: {
    newTech: NewTechFields;
    confirmedEdges: ConfirmedEdge[];
  }): void => {
    setLiveDecision({
      path: 'B',
      newTech: payload.newTech,
      confirmedEdges: payload.confirmedEdges,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <AiRecommendationCard
        recommendation={interrupt}
        onManualPathSelect={setSelectedPath}
      />

      {selectedPath === null && interrupt.path !== 'ai_failed' && (
        <div className="rounded-xl border border-[#c3c6d5] bg-white p-4 shadow-[0_24px_40px_rgba(0,31,42,0.06)]">
          <p className="text-sm font-bold text-[#001f2a]">請選擇路徑</p>
          <div className="mt-3 flex gap-2">
            {MANUAL_SELECT_OPTIONS.map(option => (
              <button
                key={option.path}
                type="button"
                onClick={() => setSelectedPath(option.path)}
                className="rounded-lg border border-[#c3c6d5] bg-white px-3 py-2 text-xs font-bold text-[#003d92] hover:bg-[#f4faff]"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedPath === 'A' && (
        <PathADecisionForm
          aiSuggestedTechId={
            interrupt.path === 'A' ? interrupt.matchedTech.id : undefined
          }
          onChange={handlePathAChange}
          onSubmit={onSubmitDecision}
        />
      )}

      {selectedPath === 'B' && (
        <PathBDecisionForm
          recommendation={getPathBRecommendation(interrupt, activeKeyword)}
          newTechId={activeKeyword}
          onChange={handlePathBChange}
          onSubmit={onSubmitDecision}
        />
      )}

      {selectedPath === 'C' && (
        <PathCDecisionForm
          onSubmit={onSubmitDecision}
          onCancel={() => setSelectedPath(null)}
        />
      )}

      {liveDecision && (
        <CommitPreviewPanel keyword={activeKeyword} decision={liveDecision} />
      )}
    </div>
  );
}
