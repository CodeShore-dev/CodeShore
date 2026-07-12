import { AI_SUGGESTION_WORKFLOW_PURPOSE } from '../content/aiWorkflows';
import type { AiSuggestionWorkflowInfo } from '../service';
import { PromptDisclosureBlock } from './PromptDisclosureBlock';

export interface AiSuggestionWorkflowListProps {
  workflows: readonly AiSuggestionWorkflowInfo[];
}

// Lists the 5 ai-suggestion sub-workflows, pairing each with its static
// purpose text (`AI_SUGGESTION_WORKFLOW_PURPOSE`, keyed by `workflow.workflow`)
// and rendering one `PromptDisclosureBlock` per `workflow.steps` entry
// (design.md「前端元件摘要」`AiSuggestionWorkflowList`; requirements 2.1, 2.2, 2.3).
export function AiSuggestionWorkflowList({
  workflows,
}: AiSuggestionWorkflowListProps) {
  return (
    <div>
      {workflows.map(workflow => (
        <div key={workflow.workflow} className="mb-8">
          <h3 className="mb-1 text-lg font-bold text-[#001f2a]">
            {workflow.label}
          </h3>
          <p className="mb-4 text-sm text-[#434653]">
            {AI_SUGGESTION_WORKFLOW_PURPOSE[workflow.workflow]}
          </p>
          {workflow.steps.map(step => (
            <PromptDisclosureBlock
              key={step.toolName}
              label={step.stepLabel}
              toolName={step.toolName}
              systemPrompt={step.systemPrompt}
              inputSchema={step.inputSchema}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
