import { useKeywordCurationFlowView } from '../composables/useKeywordCurationFlowView';
import {
  KEYWORD_CURATION_INTRO,
  KEYWORD_CURATION_PATH_PURPOSE,
} from '../content/aiWorkflows';
import { keywordCurationFlow } from '../content/keywordCurationFlow';
import type { KeywordCurationWorkflowInfo } from '../service';
import { DiagramNodeDetail } from './diagram/DiagramNodeDetail';
import { KeywordCurationFlowDiagram } from './KeywordCurationFlowDiagram';
import { PromptDisclosureBlock } from './PromptDisclosureBlock';

export interface KeywordCurationWorkflowPanelProps {
  info: KeywordCurationWorkflowInfo;
}

// Renders the keyword-curation guided workflow explanation: the static intro
// (which spells out the human-verification gate, requirement 3.2), a flow
// diagram of the real 5-node LangGraph (fetchContext → classify → one of the
// 3 commit nodes, mirroring graph.ts's routeByDecision routing), the 3
// decision paths (A/B/C) each paired with its purpose text, and ONE shared
// PromptDisclosureBlock for the classifier — the 3 paths all come from a
// single classify_keyword LLM call, so the prompt/schema disclosure is not
// repeated per path (design.md「前端元件摘要」`KeywordCurationWorkflowPanel`;
// requirements 3.1, 3.2, 3.3).
export function KeywordCurationWorkflowPanel({
  info,
}: KeywordCurationWorkflowPanelProps) {
  const flowState = useKeywordCurationFlowView();

  return (
    <div>
      <p className="mb-4 text-sm text-[#434653]">{KEYWORD_CURATION_INTRO}</p>

      <div className="mb-6 gap-2 space-y-6 md:flex md:space-y-0">
        <KeywordCurationFlowDiagram
          view={flowState.activeView}
          nodes={keywordCurationFlow.nodes}
          selectedNodeId={flowState.selectedNodeId}
          onSelectNode={flowState.selectNode}
        />
        <DiagramNodeDetail node={flowState.selectedNode} onClose={flowState.clearSelection} />
      </div>

      <div className="mb-6">
        {info.paths.map(path => (
          <div key={path.path} className="mb-3">
            <h4 className="font-bold text-[#001f2a]">{path.label}</h4>
            <p className="text-sm text-[#434653]">
              {KEYWORD_CURATION_PATH_PURPOSE[path.path]}
            </p>
          </div>
        ))}
      </div>
      <PromptDisclosureBlock
        label="AI 分類器"
        toolName={info.toolName}
        systemPrompt={info.systemPrompt}
        inputSchema={info.inputSchema}
      />
    </div>
  );
}
