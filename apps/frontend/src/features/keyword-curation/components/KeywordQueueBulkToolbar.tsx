import { useBulkExcludeKeywordsMutation } from '../mutations';
import { useQueueStore } from '../queueStore';
import type { QueuedKeyword } from '../service';

interface KeywordQueueBulkToolbarProps {
  keywords: QueuedKeyword[];
}

// Bulk-selection toolbar for the keyword queue, mirroring
// `keyword/components/TechBulkToolbar.tsx`'s established shape. Shown only
// while select mode is on; select-all toggles the current page, and the
// bulk action rejects every selected keyword into keyword_bin (path C) in
// one request -- the only decision that needs no per-keyword AI/human
// customization, so it's the one safe to batch.
export function KeywordQueueBulkToolbar({
  keywords,
}: KeywordQueueBulkToolbarProps) {
  const selectMode = useQueueStore(s => s.selectMode);
  const selectedIds = useQueueStore(s => s.selectedIds);
  const selectAll = useQueueStore(s => s.selectAll);
  const clearSelection = useQueueStore(s => s.clearSelection);
  const bulkExclude = useBulkExcludeKeywordsMutation();

  if (!selectMode) return null;

  const allSelected =
    keywords.length > 0 && selectedIds.size === keywords.length;

  const handleToggleSelectAll = (): void => {
    if (allSelected) clearSelection();
    else selectAll(keywords.map(k => k.id));
  };

  const handleBulkExclude = async (): Promise<void> => {
    if (!selectedIds.size) return;
    if (
      !confirm(
        `確定要將已選取的 ${selectedIds.size} 個 keyword 加入 keyword bin 嗎？此操作無法還原。`,
      )
    )
      return;
    await bulkExclude.mutateAsync([...selectedIds]);
    clearSelection();
  };

  return (
    <div className="mb-3 flex items-center justify-between rounded-xl border border-[#c3c6d5]/30 bg-white px-4 py-2.5 shadow-sm">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm font-semibold text-[#434653] transition hover:text-[#003d92]"
          onClick={handleToggleSelectAll}
        >
          <span
            className={`flex size-4 items-center justify-center rounded border-2 transition ${
              allSelected ? 'border-[#003d92] bg-[#003d92]' : 'border-[#c3c6d5]'
            }`}
          >
            {allSelected && (
              <span className="material-symbols-outlined text-sm text-white">
                check
              </span>
            )}
          </span>
          {allSelected ? '取消全選' : '全選本頁'}
        </button>
        <span className="text-sm text-[#434653]/60">
          已選 {selectedIds.size} / {keywords.length}
        </span>
      </div>
      <button
        type="button"
        disabled={!selectedIds.size || bulkExclude.isPending}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-[#ba1a1a] transition hover:bg-[#ba1a1a]/10 disabled:opacity-30"
        onClick={handleBulkExclude}
      >
        <span
          className={`material-symbols-outlined text-base ${
            bulkExclude.isPending ? 'animate-spin' : ''
          }`}
        >
          {bulkExclude.isPending ? 'progress_activity' : 'delete_sweep'}
        </span>
        加入 Keyword Bin {selectedIds.size ? `(${selectedIds.size})` : ''}
      </button>
    </div>
  );
}
