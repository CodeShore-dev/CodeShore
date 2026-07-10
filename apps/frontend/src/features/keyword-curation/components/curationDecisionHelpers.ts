import { CATEGORY_LABEL_MAP } from '../../../utils/constants';
import type { AiRecommendation, HumanDecision } from '../service';

export type ManualPath = 'A' | 'B' | 'C';

// There is no real AI-suggested path-B recommendation when the admin
// manually picks path B (either off the `ai_failed` degradation card, or by
// cancelling out of a different real recommendation and re-selecting B
// manually) -- `PathBDecisionForm` requires a `recommendation` prop, so this
// builds an empty/synthetic one: id defaults to the keyword itself (the most
// useful starting id), category defaults to the first `CATEGORY_LABEL_MAP`
// entry (the form's <select> always needs a valid selected value), and
// everything else starts empty for the admin to fill in themselves.
function buildSyntheticPathBRecommendation(
  keyword: string,
): Extract<AiRecommendation, { path: 'B' }> {
  return {
    path: 'B',
    suggestedTech: {
      id: keyword,
      label: '',
      category: Object.keys(CATEGORY_LABEL_MAP)[0] ?? '',
      tags: [],
      iconSlugs: [],
    },
    suggestedEdges: [],
    reasoning: '',
    affectedJobCount: 0,
  };
}

export function getPathBRecommendation(
  interrupt: AiRecommendation,
  activeKeyword: string,
): Extract<AiRecommendation, { path: 'B' }> {
  return interrupt.path === 'B'
    ? interrupt
    : buildSyntheticPathBRecommendation(activeKeyword);
}

// Computes the DEFAULT/initial decision for a freshly-selected path, seeded
// from the AI's suggestion (requirement 4.2, 6.1: the AI suggestion is the
// default, editable, starting point). This seeds
// CurationSessionInterrupted's `liveDecision` state, which
// PathADecisionForm/PathBDecisionForm's `onChange` callbacks subsequently
// keep in sync with the admin's live edits -- CommitPreviewPanel always
// previews `liveDecision`, not this static seed, so it reflects the actual
// decision that would be submitted (requirement 4.1, 5.1, 6.6).
export function computeInitialDecision(
  interrupt: AiRecommendation,
  selectedPath: ManualPath | null,
  activeKeyword: string,
): HumanDecision | null {
  if (!selectedPath) return null;
  switch (selectedPath) {
    case 'A':
      return {
        path: 'A',
        confirmedTechId: interrupt.path === 'A' ? interrupt.matchedTech.id : '',
      };
    case 'B': {
      const rec = getPathBRecommendation(interrupt, activeKeyword);
      return {
        path: 'B',
        newTech: {
          id: rec.suggestedTech.id || activeKeyword,
          label: rec.suggestedTech.label,
          category: rec.suggestedTech.category,
          iconSlugs: rec.suggestedTech.iconSlugs,
          tags: rec.suggestedTech.tags,
        },
        confirmedEdges: [],
      };
    }
    case 'C':
      return { path: 'C' };
  }
}
