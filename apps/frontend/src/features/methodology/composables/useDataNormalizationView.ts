import { useCallback, useMemo, useState } from 'react';

import type { DataFlowNode, DataFlowView, DataFlowViewId } from '../content/dataNormalization';
import { dataNormalization } from '../content/dataNormalization';

export interface DataNormalizationViewState {
  readonly view: DataFlowViewId;
  readonly selectedNodeId: string | null;
  readonly activeView: DataFlowView;
  readonly selectedNode: DataFlowNode | null;
  readonly setView: (view: DataFlowViewId) => void;
  readonly selectNode: (id: string) => void;
  readonly clearSelection: () => void;
}

/**
 * 資料正規化關係圖的視角／選取狀態（純前端）。切換視角時清除既有節點選取，
 * 詳細面板隨之關閉；只有 interactive 節點可被選取。
 */
export function useDataNormalizationView(): DataNormalizationViewState {
  const [view, setViewState] = useState<DataFlowViewId>(dataNormalization.defaultView);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const activeView = useMemo<DataFlowView>(() => dataNormalization.views[view], [view]);

  const selectedNode = useMemo<DataFlowNode | null>(
    () => (selectedNodeId === null ? null : (dataNormalization.nodes.find(node => node.id === selectedNodeId) ?? null)),
    [selectedNodeId],
  );

  const setView = useCallback((next: DataFlowViewId) => {
    setViewState(next);
    setSelectedNodeId(null);
  }, []);

  const selectNode = useCallback((id: string) => {
    const node = dataNormalization.nodes.find(candidate => candidate.id === id);
    if (node === undefined || !node.interactive) {
      return;
    }
    setSelectedNodeId(id);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  return {
    view,
    selectedNodeId,
    activeView,
    selectedNode,
    setView,
    selectNode,
    clearSelection,
  };
}
