import { useMemo, useState } from 'react';

import type { ConfirmedEdge, SuggestedEdge } from '../service';

export interface EdgeReviewItem {
  suggestion: SuggestedEdge;
  accepted: boolean;
  techId: string; // editable target tech id, defaults to suggestion.techId
}

// checkLocalCycle (design.md's PathBDecisionForm cycle-guard block, ~line
// 516-525; requirement 6.5): front-end-only UI feedback layer, NOT the
// authoritative check -- the backend's validateAndCommitNewTech node still
// runs detectTechParentCycle() as the final gate (task 3.4). Per the task's
// own scope ("僅覆蓋 UI 反饋層...簡化版：前端檢查直接 parent-child pair"),
// this only catches a DIRECT A->B + B->A loop among the currently-accepted
// edges -- e.g. one accepted edge is {parentId: 'a', childId: 'b'} and
// another accepted edge is the exact reverse {parentId: 'b', childId: 'a'}.
// Design.md's pseudocode signature also takes an `existingParents` param for
// checking against already-persisted tech hierarchy, but no such data source
// is available to this component (not part of AiRecommendation, and not in
// this task's declared props) -- full/transitive cycle detection against
// existing data is explicitly deferred to the backend per design.md.
export function checkLocalCycle(edges: ConfirmedEdge[]): boolean {
  return edges.some(edge =>
    edges.some(
      other => other.parentId === edge.childId && other.childId === edge.parentId,
    ),
  );
}

export function parseList(text: string): string[] {
  return text
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

// usePathBEdges: owns the accept/reject + target-tech-id editing state for
// the AI's suggestedEdges list (requirement 6.3, 6.4), derives the
// ConfirmedEdge[] that would be submitted from the currently-accepted items,
// and runs the local cycle check against that derived list (requirement
// 6.5). `newTechId` is the CURRENT (possibly admin-edited) id of the tech
// being created -- confirmedEdges must reflect live edits to the id field,
// not just the AI's original suggestion.
export function usePathBEdges(suggestedEdges: SuggestedEdge[], newTechId: string) {
  const [items, setItems] = useState<EdgeReviewItem[]>(() =>
    suggestedEdges.map(suggestion => ({
      suggestion,
      accepted: true,
      techId: suggestion.techId,
    })),
  );

  const toggleAccepted = (index: number): void => {
    setItems(prev =>
      prev.map((item, i) => (i === index ? { ...item, accepted: !item.accepted } : item)),
    );
  };

  const setTechId = (index: number, techId: string): void => {
    setItems(prev => prev.map((item, i) => (i === index ? { ...item, techId } : item)));
  };

  // Maps each accepted SuggestedEdge into a ConfirmedEdge. type === 'parent'
  // means the SUGGESTED tech is the parent and the new tech is the child;
  // type === 'child' means the new tech is the parent and the suggested tech
  // is the child.
  const confirmedEdges = useMemo<ConfirmedEdge[]>(
    () =>
      items
        .filter(item => item.accepted)
        .map(item =>
          item.suggestion.type === 'parent'
            ? { parentId: item.techId, childId: newTechId }
            : { parentId: newTechId, childId: item.techId },
        ),
    [items, newTechId],
  );

  const hasDirectCycle = useMemo(() => checkLocalCycle(confirmedEdges), [confirmedEdges]);

  return { items, toggleAccepted, setTechId, confirmedEdges, hasDirectCycle };
}
