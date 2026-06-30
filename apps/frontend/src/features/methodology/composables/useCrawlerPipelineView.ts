import { type DiagramViewState, useDiagramView } from '../components/diagram/useDiagramView';
import type { CrawlerNode, CrawlerView, CrawlerViewId } from '../content/crawlerPipeline';
import { crawlerPipeline } from '../content/crawlerPipeline';

export type CrawlerPipelineViewState = DiagramViewState<CrawlerNode, CrawlerViewId, CrawlerView>;

export function useCrawlerPipelineView(): CrawlerPipelineViewState {
  return useDiagramView(crawlerPipeline);
}
