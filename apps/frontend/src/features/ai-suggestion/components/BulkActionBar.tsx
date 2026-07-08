interface BulkActionBarProps {
  selectedCount: number;
  selectableCount: number;
  allSelected: boolean;
  onToggleAll: () => void;
  onBulkApprove: () => void;
  onBulkReject: () => void;
  approving: boolean;
  rejecting: boolean;
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
}: BulkActionBarProps) {
  if (selectableCount === 0) return null;

  return (
    <div className="border-surface-container bg-surface-container-lowest mb-3 flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm">
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
  );
}
