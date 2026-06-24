import { useCallback, useMemo, useState } from 'react';

import type {
  ArchNode,
  ArchView,
  ArchViewId,
} from '../content/cloudArchitecture';
import { cloudArchitecture } from '../content/cloudArchitecture';

export interface CloudArchitectureViewState {
  readonly view: ArchViewId;
  readonly selectedNodeId: string | null;
  readonly activeView: ArchView;
  readonly selectedNode: ArchNode | null;
  readonly setView: (view: ArchViewId) => void;
  readonly selectNode: (id: string) => void;
  readonly clearSelection: () => void;
}

export function useCloudArchitectureView(): CloudArchitectureViewState {
  const [view, setViewState] = useState<ArchViewId>(
    cloudArchitecture.defaultView,
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const activeView = useMemo<ArchView>(
    () => cloudArchitecture.views[view],
    [view],
  );

  const selectedNode = useMemo<ArchNode | null>(
    () =>
      selectedNodeId === null
        ? null
        : (cloudArchitecture.nodes.find((node) => node.id === selectedNodeId) ??
          null),
    [selectedNodeId],
  );

  const setView = useCallback((next: ArchViewId) => {
    setViewState(next);
    setSelectedNodeId(null);
  }, []);

  const selectNode = useCallback((id: string) => {
    const node = cloudArchitecture.nodes.find((candidate) => candidate.id === id);
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
