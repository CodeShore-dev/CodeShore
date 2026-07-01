import { useState } from 'react';
import { Link } from 'react-router';

import { SupabaseView } from '@codeshore/data-types';

import { TechIcon } from '../../../components/TechIcon';
import { useCanEdit } from '../../auth/authStore';
import { useIconSourceEditor } from '../hooks/useIconSourceEditor';
import {
  useDeleteKeywordItemMutation,
  useUpdateIconSlugsMutation,
} from '../mutations';
import { useTechStore } from '../techStore';
import { IconSourcePopover } from './IconSourcePopover';
import { TechCardMeta } from './TechCardMeta';

interface TechCardProps {
  group: SupabaseView.MvTech;
}

// Keyword-group card (task 8.3). Faithful port of TechCard.vue: select
// checkbox, the icon-source reorder popover (portal to body), and delete. The
// edit/assign buttons toggle local state exactly as the Vue version (no inline
// form is rendered — parity with the source). Icon-source editing state lives
// in useIconSourceEditor / IconSourcePopover to stay under the 200-line limit.
export function TechCard({ group }: TechCardProps) {
  const canEdit = useCanEdit();
  const selectMode = useTechStore(s => s.selectMode);
  const selectedIds = useTechStore(s => s.selectedIds);
  const toggleSelectId = useTechStore(s => s.toggleSelectId);

  const deleteItem = useDeleteKeywordItemMutation();
  const updateIconSlugs = useUpdateIconSlugsMutation();

  const [isEditing, setIsEditing] = useState(false);
  const [assigningKeyword, setAssigningKeyword] = useState<string | null>(null);

  const iconEditor = useIconSourceEditor(async iconSlugs => {
    await updateIconSlugs.mutateAsync({ id: group.tech, iconSlugs });
  });

  const selected = selectedIds.has(group.tech);
  const canEditIcons = canEdit && !selectMode;

  const handleCardClick = (): void => {
    if (selectMode) toggleSelectId(group.tech);
  };

  const handleDelete = async (): Promise<void> => {
    const isKeyword = group.category === null;
    if (!confirm(`確定要刪除「${group.label}」技術嗎？此操作無法還原。`)) return;
    await deleteItem.mutateAsync({ id: group.tech, isKeyword });
  };

  return (
    <>
      <div
        className={`rounded-2xl border border-[#c3c6d5]/30 bg-white shadow-sm transition dark:bg-[#001f2a] ${
          selectMode && selected
            ? 'border-[#003d92]/40 bg-[#e6f6ff]/60 dark:bg-[#003d92]/10'
            : ''
        }`}
        onClick={handleCardClick}
      >
        <div
          className={`flex items-start justify-between gap-4 px-5 py-4 ${
            selectMode ? 'cursor-pointer' : ''
          }`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {selectMode && (
              <span
                className={`flex size-4 shrink-0 items-center justify-center rounded border-2 transition ${
                  selected ? 'border-[#003d92] bg-[#003d92]' : 'border-[#c3c6d5]'
                }`}
              >
                {selected && (
                  <span className="material-symbols-outlined text-sm text-white">
                    check
                  </span>
                )}
              </span>
            )}

            {canEditIcons ? (
              <button
                type="button"
                title="點擊調整圖示來源順序"
                className="shrink-0 cursor-pointer rounded-md ring-offset-1 transition hover:ring-2 hover:ring-[#003d92]/40"
                onClick={e => {
                  e.stopPropagation();
                  if (!canEditIcons) return;
                  iconEditor.open(e, group.icon_slugs);
                }}
              >
                <TechIcon
                  slugs={group.icon_slugs}
                  label={group.label}
                  hideIfNotFound={false}
                />
              </button>
            ) : (
              <TechIcon
                slugs={group.icon_slugs}
                label={group.label}
                hideIfNotFound={false}
              />
            )}
            <span className="flex items-center gap-2 rounded-lg bg-[#e6f6ff] px-3 py-1 font-mono text-sm font-bold text-[#003d92] dark:bg-[#003d92]/30 dark:text-[#a8d4f5]">
              {group.label}
            </span>

            <Link
              to={`/jobs?${new URLSearchParams({ tags: group.tech })}`}
              className="text-sm text-[#434653] underline-offset-2 hover:underline dark:text-[#c3c6d5]"
              onClick={e => e.stopPropagation()}
            >
              {group.count} 個職缺
            </Link>

            {group.category === null && (
              <span className="rounded-full bg-[#434653]/10 px-2 py-0.5 text-sm text-[#434653] dark:bg-white/10 dark:text-[#c3c6d5]">
                關鍵字
              </span>
            )}
          </div>

          {!selectMode && (
            <div className="flex shrink-0 items-center gap-2">
              {group.category === null && canEdit
                ? assigningKeyword !== group.tech && (
                    <button
                      type="button"
                      className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-[#003d92] transition hover:bg-[#e6f6ff] dark:text-[#a8d4f5] dark:hover:bg-[#003d92]/20"
                      onClick={e => {
                        e.stopPropagation();
                        setAssigningKeyword(group.tech);
                      }}
                    >
                      <span className="material-symbols-outlined text-base">
                        merge
                      </span>
                      加入技術
                    </button>
                  )
                : group.category !== null &&
                  !isEditing &&
                  canEdit && (
                    <button
                      type="button"
                      className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-[#003d92] transition hover:bg-[#e6f6ff] dark:text-[#a8d4f5] dark:hover:bg-[#003d92]/20"
                      onClick={e => {
                        e.stopPropagation();
                        setIsEditing(true);
                      }}
                    >
                      <span className="material-symbols-outlined text-base">
                        edit
                      </span>
                      編輯
                    </button>
                  )}

              {canEdit && (
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-red-500 transition hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={e => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                  刪除
                </button>
              )}
            </div>
          )}
        </div>

        <TechCardMeta group={group} />
      </div>

      {iconEditor.editingIcons && (
        <IconSourcePopover
          editor={iconEditor}
          label={group.label}
          isSaving={updateIconSlugs.isPending}
        />
      )}
    </>
  );
}
