import { useEffect, useRef, useState } from 'react';

import { AiSuggestionWorkflow } from '@codeshore/data-types';

import { WORKFLOW_OPTIONS } from '../constants';
import { useGenerateSuggestions } from '../useGenerateSuggestions';
import { LlmSettingsPanel } from './LlmSettingsPanel';
import { WorkflowInfoPanel } from './WorkflowInfoPanel';

// "產生建議" panel: LLM settings, workflow-info transparency, the
// workflow/model-override controls, the generate button, and the SSE
// progress log. Extracted out of `AiSuggestionReviewPage` to keep it under
// this repo's 200-line `max-lines` limit -- same rationale as
// `SuggestionFilterBar`/`LlmSettingsPanel`.
export function GenerateSuggestionsPanel() {
  const [workflow, setWorkflow] = useState<AiSuggestionWorkflow | 'all'>('all');
  // Optional per-call model override for this run only (empty = use the
  // backend-adjustable stored default, no override sent).
  const [modelOverride, setModelOverride] = useState('');
  const generate = useGenerateSuggestions();

  const logRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [generate.progress.length]);

  const showLog = generate.progress.length > 0 || generate.running || generate.done;

  return (
    <section className="border-surface-container bg-surface-container-lowest mb-8 rounded-2xl border p-5">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">
          auto_awesome
        </span>
        <h3 className="text-on-surface mb-0 font-bold">產生建議</h3>
        {generate.running && (
          <span className="material-symbols-outlined text-primary animate-spin text-base">
            progress_activity
          </span>
        )}
      </div>

      <LlmSettingsPanel />
      <WorkflowInfoPanel />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select
          value={workflow}
          className="border-surface-container bg-surface-container text-on-surface rounded-lg border py-1.5 pr-8 pl-2 text-sm"
          onChange={e =>
            setWorkflow(e.target.value as AiSuggestionWorkflow | 'all')
          }
        >
          <option value="all">全部子工作流</option>
          {WORKFLOW_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={modelOverride}
          placeholder="模型覆寫（選填）"
          data-testid="model-override-input"
          className="border-surface-container bg-surface-container text-on-surface rounded-lg border py-1.5 px-2 text-sm"
          onChange={e => setModelOverride(e.target.value)}
        />
        <button
          type="button"
          data-testid="generate-button"
          className="bg-primary text-on-primary hover:bg-primary/90 cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
          disabled={generate.running}
          onClick={() =>
            generate.start(
              workflow === 'all' ? undefined : workflow,
              modelOverride.trim() || undefined,
            )
          }
        >
          產生建議
        </button>
        {generate.done && generate.createdTotal !== null && (
          <span className="text-on-surface-variant text-sm">
            共產生 {generate.createdTotal} 筆建議
          </span>
        )}
      </div>

      {showLog && (
        <div className="border-surface-container mt-4 overflow-hidden rounded-lg border">
          <div className="bg-surface-container flex items-center justify-between px-3 py-2">
            <span className="text-on-surface-variant text-sm font-bold tracking-widest">
              產生進度
            </span>
            {generate.done ? (
              <button
                type="button"
                className="text-on-surface-variant hover:text-on-surface cursor-pointer text-sm transition-colors"
                onClick={generate.clear}
              >
                ✕
              </button>
            ) : (
              <span className="material-symbols-outlined text-primary animate-spin text-sm">
                progress_activity
              </span>
            )}
          </div>
          <div
            ref={logRef}
            className="bg-surface-container-lowest max-h-64 overflow-y-auto p-3 font-mono text-[11px]"
          >
            {generate.progress.map((line, i) => (
              <div
                key={i}
                className="text-on-surface-variant leading-5 break-all whitespace-pre-wrap"
              >
                {line}
              </div>
            ))}
            {!generate.progress.length && (
              <div className="text-on-surface-variant/50 italic">啟動中…</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
