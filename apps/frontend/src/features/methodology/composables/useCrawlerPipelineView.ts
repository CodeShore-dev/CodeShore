import { useCallback, useMemo, useState } from 'react';

import type { CrawlerNode, CrawlerView, CrawlerViewId } from '../content/crawlerPipeline';
import { crawlerPipeline } from '../content/crawlerPipeline';

export interface CrawlerPipelineViewState {
  readonly view: CrawlerViewId;
  readonly selectedNodeId: string | null;
  readonly activeView: CrawlerView;
  readonly selectedNode: CrawlerNode | null;
  readonly setView: (view: CrawlerViewId) => void;
  readonly selectNode: (id: string) => void;
  readonly clearSelection: () => void;
}

export function useCrawlerPipelineView(): CrawlerPipelineViewState {
  const [view, setViewState] = useState<CrawlerViewId>(crawlerPipeline.defaultView);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const activeView = useMemo<CrawlerView>(() => crawlerPipeline.views[view], [view]);

  const selectedNode = useMemo<CrawlerNode | null>(
    () => (selectedNodeId === null ? null : (crawlerPipeline.nodes.find(node => node.id === selectedNodeId) ?? null)),
    [selectedNodeId],
  );

  const setView = useCallback((next: CrawlerViewId) => {
    setViewState(next);
    setSelectedNodeId(null);
  }, []);

  const selectNode = useCallback((id: string) => {
    const node = crawlerPipeline.nodes.find(candidate => candidate.id === id);
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
