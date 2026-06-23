import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  useKeywordCategoriesQuery,
  useKeywordGroupsQuery,
  useSaveKeywordToGroupMutation,
} from '../../keyword/queries';

interface JobKeywordPopoverProps {
  keyword: string;
  x: number;
  y: number;
  onClose: () => void;
}

// Admin popover to assign a selected JD keyword to a keyword group (task 7.5),
// ported from JobKeywordPopover.vue. Rendered in a portal at the selection.
export function JobKeywordPopover({
  keyword,
  x,
  y,
  onClose,
}: JobKeywordPopoverProps) {
  const { data: keywordGroups = [] } = useKeywordGroupsQuery();
  const { tabs } = useKeywordCategoriesQuery();
  const saveMutation = useSaveKeywordToGroupMutation();

  const [groupSearch, setGroupSearch] = useState(keyword.toLowerCase());
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [newGroupCategory, setNewGroupCategory] = useState<string | null>(null);

  useEffect(() => {
    setGroupSearch(keyword.toLowerCase());
    setShowSuggestions(false);
    setNewGroupCategory(null);
  }, [keyword]);

  const groupSuggestions = useMemo(() => {
    const q = groupSearch.toLowerCase();
    return keywordGroups
      .filter(g => g.keyword_group.toLowerCase().includes(q))
      .slice(0, 8);
  }, [groupSearch, keywordGroups]);

  const isNewGroup = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return false;
    return !keywordGroups.some(g => g.keyword_group.toLowerCase() === q);
  }, [groupSearch, keywordGroups]);

  const availableTags = useMemo(
    () =>
      tabs.filter(t => t.value !== '').map(t => ({ label: t.label, value: t.value })),
    [tabs],
  );

  const selectGroup = (groupName: string) => {
    setGroupSearch(groupName);
    setShowSuggestions(false);
    setNewGroupCategory(null);
  };

  const closePopover = () => {
    setGroupSearch('');
    setShowSuggestions(false);
    setNewGroupCategory(null);
    onClose();
  };

  const confirmSave = async () => {
    if (!keyword || !groupSearch.trim()) return;
    await saveMutation.mutateAsync({
      groupId: groupSearch.trim(),
      keyword,
      category: isNewGroup ? newGroupCategory || 'Others' : undefined,
    });
    closePopover();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50"
      onMouseDown={event => {
        if (event.target === event.currentTarget) closePopover();
      }}
    >
      <div
        className="absolute min-w-64 rounded-xl bg-white p-4 shadow-2xl"
        style={{ left: `${x}px`, top: `${y - 8}px`, transform: 'translate(-50%, -100%)' }}
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="mb-3">
          <span className="mb-1 block text-sm font-bold tracking-widest text-[#434653]">
            選取的關鍵字
          </span>
          <span className="rounded-full bg-[#003d92] px-3 py-1 text-sm font-bold text-white">
            {keyword}
          </span>
        </div>

        <div className="relative mb-3">
          <span className="mb-1 block text-sm font-bold tracking-widest text-[#434653]">
            加入關鍵字組
          </span>
          <input
            value={groupSearch}
            type="text"
            placeholder="搜尋或輸入群組名稱..."
            className="w-full rounded-lg border border-[#c3c6d5] bg-[#f4faff] px-3 py-2 text-sm font-bold text-[#001f2a] placeholder-[#434653]/50 focus:outline-none"
            onChange={e => setGroupSearch(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          />
          {showSuggestions && groupSuggestions.length > 0 && (
            <ul className="absolute top-full left-0 z-10 mt-1 w-full overflow-hidden rounded-lg border border-[#c3c6d5] bg-white shadow-lg">
              {groupSuggestions.map(g => (
                <li
                  key={g.keyword_group}
                  className="cursor-pointer px-3 py-2 text-sm font-bold transition-colors hover:bg-[#f4faff]"
                  onMouseDown={e => {
                    e.preventDefault();
                    selectGroup(g.keyword_group);
                  }}
                >
                  {g.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        {isNewGroup && (
          <div className="mb-3">
            <span className="mb-1 block text-sm font-bold tracking-widest text-[#434653]">
              分類
            </span>
            <div className="flex flex-wrap gap-1.5">
              {availableTags.map(tag => (
                <button
                  key={tag.value}
                  type="button"
                  className={`rounded-full px-3 py-1 text-sm font-bold transition-colors ${
                    newGroupCategory === tag.value
                      ? 'bg-[#003d92] text-white'
                      : 'bg-[#f4faff] text-[#434653] hover:bg-[#d9f2ff] hover:text-[#001f2a]'
                  }`}
                  onMouseDown={e => {
                    e.preventDefault();
                    setNewGroupCategory(
                      newGroupCategory === tag.value ? null : tag.value,
                    );
                  }}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-bold text-[#434653] transition-colors hover:bg-[#f4faff]"
            onClick={closePopover}
          >
            取消
          </button>
          <button
            type="button"
            disabled={!groupSearch.trim() || saveMutation.isPending}
            className="cursor-pointer rounded-lg bg-[#003d92] px-3 py-1.5 text-sm font-bold text-white transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={confirmSave}
          >
            {saveMutation.isPending ? '儲存中...' : '儲存'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
