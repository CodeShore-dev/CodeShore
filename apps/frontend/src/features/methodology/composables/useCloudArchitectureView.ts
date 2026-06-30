import { type DiagramViewState, useDiagramView } from '../components/diagram/useDiagramView';
import type { ArchNode, ArchView, ArchViewId } from '../content/cloudArchitecture';
import { cloudArchitecture } from '../content/cloudArchitecture';

export type CloudArchitectureViewState = DiagramViewState<ArchNode, ArchViewId, ArchView>;

export function useCloudArchitectureView(): CloudArchitectureViewState {
  return useDiagramView(cloudArchitecture);
}
