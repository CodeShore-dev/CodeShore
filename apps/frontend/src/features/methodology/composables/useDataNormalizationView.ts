import { type DiagramViewState, useDiagramView } from '../components/diagram/useDiagramView';
import type { DataFlowNode, DataFlowView, DataFlowViewId } from '../content/dataNormalization';
import { dataNormalization } from '../content/dataNormalization';

export type DataNormalizationViewState = DiagramViewState<DataFlowNode, DataFlowViewId, DataFlowView>;

/**
 * 資料正規化關係圖的視角／選取狀態（純前端）。切換視角時清除既有節點選取，
 * 詳細面板隨之關閉；只有 interactive 節點可被選取。共用 useDiagramView。
 */
export function useDataNormalizationView(): DataNormalizationViewState {
  return useDiagramView(dataNormalization);
}
