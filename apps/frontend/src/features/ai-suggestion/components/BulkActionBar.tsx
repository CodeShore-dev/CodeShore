interface PartialFailure {
  action: 'approve' | 'reject';
  failed: number;
}

interface BulkActionBarProps {
  selectedCount: number;
  selectableCount: number;
  allSelected: boolean;
  onToggleAll: () => void;
  onBulkApprove: () => void;
  onBulkReject: () => void;
  approving: boolean;
  rejecting: boolean;
  // Non-null after a bulk action where at least one id failed (e.g. someone
  // else already reviewed it, a 409). `Promise.allSettled` lets the rest
  // succeed rather than throwing, so without this the failed rows would just
  // silently reappear after refetch with no feedback.
  partialFailure: PartialFailure | null;
  onDismissPartialFailure: () => void;
}

// Multi-select bulk action bar: a "全選" checkbox for every pending
// suggestion currently in view, plus 核准選取/刪除選取 buttons. "刪除" (the
// user-facing label) maps onto the existing reject transition rather than a
// hard delete, since rejected suggestions must stay queryable for
// requirement 10.2's audit history -- same semantics as the single-suggestion
// 駁回 action in `SuggestionActions`.
export function BulkActionBar({
  selectedCount,
  selectableCount,
  allSelected,
  onToggleAll,
  onBulkApprove,
  onBulkReject,
  approving,
  rejecting,
  partialFailure,
  onDismissPartialFailure,
}: BulkActionBarProps) {
  if (selectableCount === 0) return null;

  return (
    <div className="mb-3 flex flex-col gap-2">
      <div className="border-surface-container bg-surface-container-lowest flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={allSelected}
            data-testid="select-all-suggestions"
            onChange={onToggleAll}
          />
          <span className="text-on-surface-variant">全選</span>
        </label>
        <span className="text-on-surface-variant">
          已選取 {selectedCount} 筆
        </span>
        <button
          type="button"
          data-testid="bulk-approve"
          className="bg-primary text-on-primary cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          disabled={selectedCount === 0 || approving}
          onClick={onBulkApprove}
        >
          核准選取
        </button>
        <button
          type="button"
          data-testid="bulk-reject"
          className="bg-error text-on-error cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          disabled={selectedCount === 0 || rejecting}
          onClick={onBulkReject}
        >
          刪除選取
        </button>
      </div>
      {partialFailure && (
        <div
          data-testid="bulk-partial-failure"
          className="bg-error-container text-on-error-container flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
        >
          <span>
            {partialFailure.failed} 筆
            {partialFailure.action === 'approve' ? '核准' : '刪除'}
            失敗，可能已被其他人處理，請重新整理後確認。
          </span>
          <button
            type="button"
            className="cursor-pointer hover:underline"
            onClick={onDismissPartialFailure}
          >
            關閉
          </button>
        </div>
      )}
    </div>
  );
}
