import { useState } from 'react';

import { useWorkflowInfoQuery } from '../queries';
import type { WorkflowInfo, WorkflowPromptStep } from '../service';

// Renders a single LLM-call step's real, static system prompt and input
// schema (both sourced from `GET /ai-suggestion/workflow-info`, itself
// sourced directly from the generator files' own exported constants -- see
// `apps/backend/src/features/ai-suggestion/workflow-info.ts`'s doc comment
// for the "single source of truth" rationale, mirroring
// `MethodologyPage`'s "資料來源 SQL" section).
function WorkflowStepBlock({ step }: { step: WorkflowPromptStep }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-on-surface text-sm font-bold">{step.stepLabel}</span>
        <span className="border-surface-container text-on-surface-variant rounded border px-1.5 py-0.5 font-mono text-[11px]">
          tool: {step.toolName}
        </span>
      </div>

      <p className="text-on-surface-variant mb-1 text-xs font-semibold tracking-widest">
        System Prompt
      </p>
      <pre className="bg-surface-container-lowest border-surface-container mb-3 max-h-64 overflow-auto rounded-lg border p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
        {step.systemPrompt}
      </pre>

      <p className="text-on-surface-variant mb-1 text-xs font-semibold tracking-widest">
        Input Schema
      </p>
      <pre className="bg-surface-container-lowest border-surface-container max-h-64 overflow-auto rounded-lg border p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
        {JSON.stringify(step.inputSchema, null, 2)}
      </pre>
    </div>
  );
}

function WorkflowInfoCard({ workflow }: { workflow: WorkflowInfo }) {
  return (
    <div
      data-testid={`workflow-info-${workflow.workflow}`}
      className="border-surface-container rounded-lg border p-4"
    >
      <h4 className="text-on-surface mb-3 font-bold">{workflow.label}</h4>
      {workflow.steps.map(step => (
        <WorkflowStepBlock key={step.stepLabel} step={step} />
      ))}
    </div>
  );
}

// Collapsible transparency panel (task addition to AiSuggestionReviewPage):
// shows the real, static LLM system prompt template and expected output
// (tool name / input schema) each of the 5 sub-workflows actually uses at
// runtime -- not a live example, since that would depend on live DB data.
// Default collapsed to avoid cluttering the review page; manages its own
// toggle state internally so the page only needs to mount `<WorkflowInfoPanel />`.
// Extracted into its own file (rather than inlined in
// `AiSuggestionReviewPage`) both because a 5-workflow prompt dump is a lot
// of markup, and to keep the page under this repo's 200-line `max-lines`
// limit -- same rationale as `LlmSettingsPanel`/`SuggestionFilterBar`.
export function WorkflowInfoPanel() {
  const [expanded, setExpanded] = useState(false);
  const workflowInfoQuery = useWorkflowInfoQuery();
  const workflows = workflowInfoQuery.data ?? [];

  return (
    <div className="mt-4">
      <button
        type="button"
        data-testid="workflow-info-toggle"
        className="text-primary flex cursor-pointer items-center gap-1 text-sm font-semibold hover:underline"
        onClick={() => setExpanded(prev => !prev)}
      >
        <span className="material-symbols-outlined text-base">info</span>
        查看工作流說明
        <span className="material-symbols-outlined text-base">
          {expanded ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {expanded && (
        <div
          data-testid="workflow-info-panel"
          className="border-surface-container bg-surface-container-lowest mt-3 flex flex-col gap-4 rounded-lg border p-4"
        >
          <p className="text-on-surface-variant text-xs leading-relaxed">
            以下是各子工作流實際使用的 LLM system prompt 與預期輸出 schema，於執行時直接取自產生器程式碼常數（非即時範例，避免受即時資料庫資料影響），確保與實際行為不會失真。
          </p>
          {workflowInfoQuery.isLoading ? (
            <p className="text-on-surface-variant text-sm">載入中…</p>
          ) : (
            workflows.map(workflow => (
              <WorkflowInfoCard key={workflow.workflow} workflow={workflow} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
