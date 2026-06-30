import { useCallback, useMemo, useState } from 'react';

import type { DiagramNodeBase, DiagramRegistry, DiagramViewBase } from './types';

export interface DiagramViewState<
  TNode extends DiagramNodeBase,
  TViewId extends string,
  TView extends DiagramViewBase,
> {
  readonly view: TViewId;
  readonly selectedNodeId: string | null;
  readonly activeView: TView;
  readonly selectedNode: TNode | null;
  readonly setView: (view: TViewId) => void;
  readonly selectNode: (id: string) => void;
  readonly clearSelection: () => void;
}

/**
 * 關係圖區塊的視角／選取狀態（純前端，領域無關）。
 *
 * 由四個 methodology 關係圖共用：切換視角時清除既有節點選取（詳細面板隨之關閉），
 * 只有 interactive 節點可被選取，且同時只能選取一個。各 domain 以自己的 content
 * registry 呼叫本 hook 即可，型別由 registry 推導。
 */
export function useDiagramView<TNode extends DiagramNodeBase, TViewId extends string, TView extends DiagramViewBase>(
  registry: DiagramRegistry<TNode, TViewId, TView>,
): DiagramViewState<TNode, TViewId, TView> {
  const [view, setViewState] = useState<TViewId>(registry.defaultView);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const activeView = useMemo<TView>(() => registry.views[view], [registry, view]);

  const selectedNode = useMemo<TNode | null>(
    () => (selectedNodeId === null ? null : (registry.nodes.find(node => node.id === selectedNodeId) ?? null)),
    [registry, selectedNodeId],
  );

  const setView = useCallback((next: TViewId) => {
    setViewState(next);
    setSelectedNodeId(null);
  }, []);

  const selectNode = useCallback(
    (id: string) => {
      const node = registry.nodes.find(candidate => candidate.id === id);
      if (node === undefined || !node.interactive) {
        return;
      }
      setSelectedNodeId(id);
    },
    [registry],
  );

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
