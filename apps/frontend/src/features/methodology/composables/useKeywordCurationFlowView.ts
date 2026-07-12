import { type DiagramViewState, useDiagramView } from '../components/diagram/useDiagramView';
import type { CurationFlowNode, CurationFlowView, CurationFlowViewId } from '../content/keywordCurationFlow';
import { keywordCurationFlow } from '../content/keywordCurationFlow';

export type KeywordCurationFlowViewState = DiagramViewState<CurationFlowNode, CurationFlowViewId, CurationFlowView>;

/**
 * Keyword 策展流程圖的選取狀態（純前端）。只有一個 view，故不需要視角切換邏輯，
 * 但仍共用 useDiagramView 以取得一致的節點選取／關閉行為（只有 interactive 節點可選取）。
 */
export function useKeywordCurationFlowView(): KeywordCurationFlowViewState {
  return useDiagramView(keywordCurationFlow);
}
