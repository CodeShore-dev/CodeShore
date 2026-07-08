import {
  ACTION_LABELS,
  TARGET_TABLE_LABELS,
  WORKFLOW_LABELS,
} from '../constants';
import { AiSuggestionRecord } from '../service';
import { SuggestionActions } from './SuggestionActions';
import { SuggestionEvidence } from './SuggestionEvidence';

interface SuggestionCardProps {
  suggestion: AiSuggestionRecord;
  detail?: AiSuggestionRecord;
  detailLoading?: boolean;
  expanded: boolean;
  onToggleDetail: () => void;
  onApprove: (id: string, editedPayload?: Record<string, unknown>) => void;
  onReject: (id: string, note?: string) => void;
  approving: boolean;
  rejecting: boolean;
  // Multi-select checkbox (bulk approve/reject): only rendered while pending,
  // since a reviewed suggestion has no bulk action to apply to it.
  selected: boolean;
  onToggleSelect: (id: string) => void;
}

// A single pending/reviewed suggestion (requirement 7.1, 7.2, 7.3, 7.4):
// summary + conditional evidence badges, a "查看詳情" toggle backed by
// `useSuggestionQuery`, and (while pending) the approve/reject action panel
// (`SuggestionActions`).
export function SuggestionCard({
  suggestion,
  detail,
  detailLoading,
  expanded,
  onToggleDetail,
  onApprove,
  onReject,
  approving,
  rejecting,
  selected,
  onToggleSelect,
}: SuggestionCardProps) {
  const isPending = suggestion.status === 'pending';

  return (
    <div
      className="border-surface-container bg-surface-container-lowest rounded-2xl border p-5"
      data-testid={`suggestion-${suggestion.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          {isPending && (
            <input
              type="checkbox"
              checked={selected}
              data-testid={`select-${suggestion.id}`}
              className="mt-1 cursor-pointer"
              aria-label="選取此建議"
              onChange={() => onToggleSelect(suggestion.id)}
            />
          )}
          <div>
            <div className="text-on-surface-variant flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="bg-surface-container rounded-full px-2 py-0.5">
                {WORKFLOW_LABELS[suggestion.workflow]}
              </span>
              <span>→</span>
              <span className="text-on-surface">
                {TARGET_TABLE_LABELS[suggestion.target_table]}
              </span>
              <span className="bg-surface-container rounded-full px-2 py-0.5">
                {ACTION_LABELS[suggestion.action]}
              </span>
            </div>
            <p className="text-on-surface-variant mt-2 font-mono text-xs break-all">
              {Object.entries(suggestion.target_key ?? {})
                .map(([k, v]) => `${k}=${v}`)
                .join(', ') || '（新建立項目）'}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="text-primary shrink-0 cursor-pointer text-xs font-semibold hover:underline"
          onClick={onToggleDetail}
        >
          {expanded ? '收合詳情' : '查看詳情'}
        </button>
      </div>

      <div className="mt-3">
        <SuggestionEvidence evidence={suggestion.evidence} />
      </div>

      {expanded && (
        <div className="border-surface-container bg-surface-container mt-3 rounded-xl border p-3">
          {detailLoading ? (
            <p className="text-on-surface-variant text-xs">載入詳情中…</p>
          ) : (
            <>
              <p className="text-on-surface-variant text-xs whitespace-pre-wrap">
                {detail?.evidence.reasoning ?? suggestion.evidence.reasoning}
              </p>
              <pre className="text-on-surface-variant mt-2 overflow-x-auto text-xs">
                {JSON.stringify((detail ?? suggestion).payload, null, 2)}
              </pre>
              {suggestion.status !== 'pending' && (
                <p className="text-on-surface-variant mt-2 text-xs">
                  審核者：{suggestion.reviewed_by ?? '—'}・審核時間：
                  {suggestion.reviewed_at ?? '—'}
                  {suggestion.resolution_note
                    ? `・備註：${suggestion.resolution_note}`
                    : ''}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {isPending ? (
        <SuggestionActions
          suggestion={suggestion}
          onApprove={onApprove}
          onReject={onReject}
          approving={approving}
          rejecting={rejecting}
        />
      ) : (
        <p className="text-on-surface-variant mt-3 text-xs font-semibold">
          {suggestion.status === 'approved' ? '已核准' : '已駁回'}
        </p>
      )}
    </div>
  );
}
