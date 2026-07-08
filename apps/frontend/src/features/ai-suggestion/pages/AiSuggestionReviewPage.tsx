import { useState } from 'react';

import { AiSuggestionStatus, AiSuggestionTargetTable } from '@codeshore/data-types';

import { BulkActionBar } from '../components/BulkActionBar';
import { GenerateSuggestionsPanel } from '../components/GenerateSuggestionsPanel';
import { SuggestionCard } from '../components/SuggestionCard';
import { SuggestionFilterBar } from '../components/SuggestionFilterBar';
import { useApproveSuggestionMutation, useRejectSuggestionMutation } from '../mutations';
import { useSuggestionQuery, useSuggestionsQuery } from '../queries';
import { useSuggestionSelection } from '../useSuggestionSelection';

// AI 建議審核頁（task 5.1，requirements 7.1-7.4）：依目標資料表／狀態篩選待審
// 建議清單、查看單筆詳情與證據、核准（可修改後核准）／駁回，以及觸發產生建議
// 的 SSE 進度。掛載於 /admin/ai-suggestions，由 AdminRoute 保護。
export function AiSuggestionReviewPage() {
  const [targetTable, setTargetTable] = useState<AiSuggestionTargetTable | ''>('');
  const [status, setStatus] = useState<AiSuggestionStatus | ''>('pending');
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

  const suggestions = suggestionsQuery.data?.result ?? [];
  const count = suggestionsQuery.data?.count ?? 0;
  const selectableIds = suggestions
    .filter(s => s.status === 'pending')
    .map(s => s.id);
  const selection = useSuggestionSelection(selectableIds);

  return (
    <div className="w-full">
      <header className="mb-6">
        <h1 className="text-on-surface text-2xl font-black">AI 建議審核</h1>
        <p className="text-on-surface-variant mt-1 text-sm">
          審核 AI 產生的資料維護建議（僅限管理員）
        </p>
      </header>

      <GenerateSuggestionsPanel />

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

      <BulkActionBar
        selectedCount={selection.selectedIds.size}
        selectableCount={selectableIds.length}
        allSelected={
          selectableIds.length > 0 &&
          selection.selectedIds.size === selectableIds.length
        }
        onToggleAll={selection.toggleSelectAll}
        onBulkApprove={selection.bulkApprove}
        onBulkReject={selection.bulkReject}
        approving={selection.approving}
        rejecting={selection.rejecting}
        partialFailure={selection.partialFailure}
        onDismissPartialFailure={selection.dismissPartialFailure}
      />

      <div className="flex flex-col gap-3">
        {suggestionsQuery.isLoading ? (
          <p className="text-on-surface-variant text-sm">載入中…</p>
        ) : suggestions.length ? (
          suggestions.map(suggestion => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              selected={selection.selectedIds.has(suggestion.id)}
              onToggleSelect={selection.toggleSelect}
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
