import { useEffect, useRef, useState } from 'react';

import {
  AiSuggestionStatus,
  AiSuggestionTargetTable,
  AiSuggestionWorkflow,
} from '@codeshore/data-types';

import { SuggestionCard } from '../components/SuggestionCard';
import { SuggestionFilterBar } from '../components/SuggestionFilterBar';
import { WORKFLOW_OPTIONS } from '../constants';
import { useApproveSuggestionMutation, useRejectSuggestionMutation } from '../mutations';
import { useSuggestionQuery, useSuggestionsQuery } from '../queries';
import { useGenerateSuggestions } from '../useGenerateSuggestions';

// AI 建議審核頁（task 5.1，requirements 7.1-7.4）：依目標資料表／狀態篩選待審
// 建議清單、查看單筆詳情與證據、核准（可修改後核准）／駁回，以及觸發產生建議
// 的 SSE 進度。掛載於 /admin/ai-suggestions，由 AdminRoute 保護。
export function AiSuggestionReviewPage() {
  const [targetTable, setTargetTable] = useState<AiSuggestionTargetTable | ''>('');
  const [status, setStatus] = useState<AiSuggestionStatus | ''>('pending');
  const [workflow, setWorkflow] = useState<AiSuggestionWorkflow | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Requirement 10.2: 依時間範圍查詢歷史建議紀錄. Plain `date` inputs (YYYY-MM-DD)
  // are already valid ISO-8601 date strings, so they pass through to the
  // filter/query params as-is without extra formatting.
  const [createdAfter, setCreatedAfter] = useState('');
  const [createdBefore, setCreatedBefore] = useState('');

  const suggestionsQuery = useSuggestionsQuery({
    targetTable: targetTable || undefined,
    status: status || undefined,
    createdAfter: createdAfter || undefined,
    createdBefore: createdBefore || undefined,
  });
  const detailQuery = useSuggestionQuery(expandedId ?? undefined);
  const approveMutation = useApproveSuggestionMutation();
  const rejectMutation = useRejectSuggestionMutation();
  const generate = useGenerateSuggestions();

  const suggestions = suggestionsQuery.data?.result ?? [];
  const count = suggestionsQuery.data?.count ?? 0;

  const logRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [generate.progress.length]);

  const showLog = generate.progress.length > 0 || generate.running || generate.done;

  return (
    <div className="w-full">
      <header className="mb-6">
        <h1 className="text-on-surface text-2xl font-black">AI 建議審核</h1>
        <p className="text-on-surface-variant mt-1 text-sm">
          審核 AI 產生的資料維護建議（僅限管理員）
        </p>
      </header>

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
          <button
            type="button"
            className="bg-primary text-on-primary hover:bg-primary/90 cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
            disabled={generate.running}
            onClick={() =>
              generate.start(workflow === 'all' ? undefined : workflow)
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

      <SuggestionFilterBar
        targetTable={targetTable}
        onTargetTableChange={setTargetTable}
        status={status}
        onStatusChange={setStatus}
        createdAfter={createdAfter}
        onCreatedAfterChange={setCreatedAfter}
        createdBefore={createdBefore}
        onCreatedBeforeChange={setCreatedBefore}
        count={count}
      />

      <div className="flex flex-col gap-3">
        {suggestionsQuery.isLoading ? (
          <p className="text-on-surface-variant text-sm">載入中…</p>
        ) : suggestions.length ? (
          suggestions.map(suggestion => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              detail={
                expandedId === suggestion.id ? detailQuery.data : undefined
              }
              detailLoading={
                expandedId === suggestion.id && detailQuery.isLoading
              }
              expanded={expandedId === suggestion.id}
              onToggleDetail={() =>
                setExpandedId(prev =>
                  prev === suggestion.id ? null : suggestion.id,
                )
              }
              onApprove={(id, editedPayload) =>
                approveMutation.mutate({ id, editedPayload })
              }
              onReject={(id, note) => rejectMutation.mutate({ id, note })}
              approving={approveMutation.isPending}
              rejecting={rejectMutation.isPending}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="material-symbols-outlined mb-3 text-5xl text-on-surface/20">
              inbox
            </span>
            <p className="text-on-surface-variant font-semibold">
              目前沒有符合篩選條件的建議。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
