import { SupabaseView } from '@codeshore/data-types';

import { useCanEdit } from '../../auth/authStore';
import { useBulkDeleteKeywordItemsMutation } from '../mutations';
import { useKeywordGroupStore } from '../keywordGroupStore';

interface KeywordGroupBulkToolbarProps {
  groups: SupabaseView.MvKeywordGroup[];
}

// Bulk-selection toolbar (task 8.3). Shown only to editors while select mode is
// on; select-all toggles the current page, delete removes the selected items.
export function KeywordGroupBulkToolbar({
  groups,
}: KeywordGroupBulkToolbarProps) {
  const canEdit = useCanEdit();
  const selectMode = useKeywordGroupStore(s => s.selectMode);
  const selectedIds = useKeywordGroupStore(s => s.selectedIds);
  const selectAll = useKeywordGroupStore(s => s.selectAll);
  const clearSelection = useKeywordGroupStore(s => s.clearSelection);
  const bulkDelete = useBulkDeleteKeywordItemsMutation();

  if (!canEdit || !selectMode) return null;

  const allSelected =
    groups.length > 0 && selectedIds.size === groups.length;

  const handleToggleSelectAll = (): void => {
    if (allSelected) clearSelection();
    else selectAll(groups.map(g => g.keyword_group));
  };

  const handleDeleteSelected = async (): Promise<void> => {
    if (!selectedIds.size) return;
    if (
      !confirm(
        `確定要刪除已選取的 ${selectedIds.size} 個項目嗎？此操作無法還原。`,
      )
    )
      return;
    const items = groups
      .filter(g => selectedIds.has(g.keyword_group))
      .map(g => ({ id: g.keyword_group, isKeyword: g.category === null }));
    await bulkDelete.mutateAsync(items);
    clearSelection();
  };

  return (
    <div className="mb-3 flex items-center justify-between rounded-xl border border-[#c3c6d5]/30 bg-white px-4 py-2.5 shadow-sm dark:bg-[#001f2a]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm font-semibold text-[#434653] transition hover:text-[#003d92] dark:text-[#c3c6d5]"
          onClick={handleToggleSelectAll}
        >
          <span
            className={`flex size-4 items-center justify-center rounded border-2 transition ${
              allSelected
                ? 'border-[#003d92] bg-[#003d92]'
                : 'border-[#c3c6d5]'
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
        <span className="text-sm text-[#434653]/60 dark:text-[#c3c6d5]/60">
          已選 {selectedIds.size} / {groups.length}
        </span>
      </div>
      <button
        type="button"
        disabled={!selectedIds.size || bulkDelete.isPending}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-red-500 transition hover:bg-red-50 disabled:opacity-30 dark:hover:bg-red-900/20"
        onClick={handleDeleteSelected}
      >
        <span
          className={`material-symbols-outlined text-base ${
            bulkDelete.isPending ? 'animate-spin' : ''
          }`}
        >
          {bulkDelete.isPending ? 'progress_activity' : 'delete'}
        </span>
        刪除 {selectedIds.size ? `(${selectedIds.size})` : ''}
      </button>
    </div>
  );
}
