import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';

import { SupabaseView } from '@codeshore/data-types';

import { TechIcon } from '../../../components/TechIcon';
import { CATEGORY_LABEL_MAP } from '../../../utils/constants';
import { useCanEdit } from '../../auth/authStore';
import {
  useDeleteKeywordItemMutation,
  useUpdateIconSlugsMutation,
} from '../mutations';
import { useKeywordGroupStore } from '../keywordGroupStore';

const ICON_SOURCES = ['thesvg', 'simple-icons', 'iconify'];

interface IconRow {
  id: number;
  source: string;
  slug: string;
}

let rowSeq = 0;

function parseEntry(entry: string): IconRow {
  const sep = entry.indexOf(':');
  return {
    id: ++rowSeq,
    source: sep < 0 ? 'iconify' : entry.slice(0, sep),
    slug: sep < 0 ? entry : entry.slice(sep + 1),
  };
}

function previewSlugs(row: IconRow): string[] {
  const slug = row.slug.trim();
  return slug ? [`${row.source}:${slug}`] : [];
}

interface KeywordGroupCardProps {
  group: SupabaseView.MvKeywordGroup;
}

// Keyword-group card (task 8.3). Faithful port of KeywordGroupCard.vue: select
// checkbox, the icon-source reorder popover (portal to body), and delete. The
// edit/assign buttons toggle local state exactly as the Vue version (no inline
// form is rendered — parity with the source).
export function KeywordGroupCard({ group }: KeywordGroupCardProps) {
  const canEdit = useCanEdit();
  const selectMode = useKeywordGroupStore(s => s.selectMode);
  const selectedIds = useKeywordGroupStore(s => s.selectedIds);
  const toggleSelectId = useKeywordGroupStore(s => s.toggleSelectId);

  const deleteItem = useDeleteKeywordItemMutation();
  const updateIconSlugs = useUpdateIconSlugsMutation();

  const [isEditing, setIsEditing] = useState(false);
  const [assigningKeyword, setAssigningKeyword] = useState<string | null>(null);
  const [editingIcons, setEditingIcons] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });
  const [iconRows, setIconRows] = useState<IconRow[]>([]);
  const popupRef = useRef<HTMLDivElement | null>(null);

  const selected = selectedIds.has(group.keyword_group);
  const canEditIcons = canEdit && !selectMode;
  const availableSources = [
    ...new Set([...ICON_SOURCES, ...iconRows.map(r => r.source)]),
  ];

  const closeIconEditor = (): void => setEditingIcons(false);

  // Close the popover on outside click / Escape while it is open.
  useEffect(() => {
    if (!editingIcons) return;
    const onOutside = (e: MouseEvent): void => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        closeIconEditor();
      }
    };
    const onKeydown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeIconEditor();
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKeydown);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKeydown);
    };
  }, [editingIcons]);

  const openIconEditor = (e: React.MouseEvent): void => {
    if (!canEditIcons) return;
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setAnchor({ x: r.left + r.width / 2, y: r.top });
    setIconRows((group.icon_slugs ?? []).map(parseEntry));
    setEditingIcons(true);
  };

  const moveIcon = (i: number, dir: -1 | 1): void => {
    const j = i + dir;
    if (j < 0 || j >= iconRows.length) return;
    const next = [...iconRows];
    [next[i], next[j]] = [next[j], next[i]];
    setIconRows(next);
  };

  const addIconRow = (): void =>
    setIconRows(rows => [...rows, { id: ++rowSeq, source: 'iconify', slug: '' }]);

  const removeIconRow = (i: number): void =>
    setIconRows(rows => rows.filter((_, idx) => idx !== i));

  const updateRow = (i: number, patch: Partial<IconRow>): void =>
    setIconRows(rows => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const saveIconOrder = async (): Promise<void> => {
    const composed = iconRows
      .filter(r => r.slug.trim())
      .map(r => `${r.source}:${r.slug.trim()}`);
    await updateIconSlugs.mutateAsync({
      id: group.keyword_group,
      iconSlugs: composed,
    });
    closeIconEditor();
  };

  const handleCardClick = (): void => {
    if (selectMode) toggleSelectId(group.keyword_group);
  };

  const handleDelete = async (): Promise<void> => {
    const isKeyword = group.category === null;
    if (
      !confirm(`確定要刪除「${group.label}」群組嗎？此操作無法還原。`)
    )
      return;
    await deleteItem.mutateAsync({ id: group.keyword_group, isKeyword });
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
                onClick={openIconEditor}
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
              to={`/jobs?${new URLSearchParams({ tags: group.keyword_group })}`}
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
                ? assigningKeyword !== group.keyword_group && (
                    <button
                      type="button"
                      className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-[#003d92] transition hover:bg-[#e6f6ff] dark:text-[#a8d4f5] dark:hover:bg-[#003d92]/20"
                      onClick={e => {
                        e.stopPropagation();
                        setAssigningKeyword(group.keyword_group);
                      }}
                    >
                      <span className="material-symbols-outlined text-base">
                        merge
                      </span>
                      加入群組
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
                  <span className="material-symbols-outlined text-base">
                    delete
                  </span>
                  刪除
                </button>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-[#c3c6d5]/20 px-5 py-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[#434653] dark:text-[#c3c6d5]">
              分類
            </span>
            <span className="rounded-full bg-[#fd7700]/15 px-2 py-0.5 text-sm font-medium text-[#fd7700]">
              {group.category ? CATEGORY_LABEL_MAP[group.category] : ''}
            </span>
            {group.parents?.length ? (
              <>
                <span className="text-sm font-semibold text-[#434653] dark:text-[#c3c6d5]">
                  父層
                </span>
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-sm font-medium text-amber-500">
                  {group.parents.join('、')}
                </span>
              </>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[#434653] dark:text-[#c3c6d5]">
              關鍵字
            </span>
            {group.keywords?.length ? (
              group.keywords.map(kw => (
                <span
                  key={kw}
                  className="rounded-full bg-[#e6f6ff] px-2 py-0.5 text-sm text-[#003d92] dark:bg-[#003d92]/20 dark:text-[#a8d4f5]"
                >
                  {kw}
                </span>
              ))
            ) : (
              <span className="text-sm text-[#434653]/50 italic dark:text-[#c3c6d5]/50">
                —
              </span>
            )}
          </div>
        </div>
      </div>

      {editingIcons &&
        createPortal(
          <div
            ref={popupRef}
            className="fixed z-50 w-92 -translate-x-1/2 -translate-y-full rounded-xl border border-[#c3c6d5]/40 bg-white p-3 shadow-[0_12px_40px_rgba(0,31,42,0.18)]"
            style={{ left: `${anchor.x}px`, top: `${anchor.y - 10}px` }}
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-[#001f2a]">圖示來源</span>
              <span className="text-[10px] text-[#434653]/60">上＝優先</span>
            </div>

            <div className="flex max-h-64 flex-col gap-1.5 overflow-auto">
              {iconRows.map((row, i) => (
                <div
                  key={row.id}
                  className="flex items-center gap-1.5 rounded-lg border border-[#eef3f8] bg-[#f7fbff] px-1.5 py-1.5"
                >
                  <TechIcon
                    slugs={previewSlugs(row)}
                    label={group.label}
                    hideIfNotFound={false}
                  />
                  <select
                    value={row.source}
                    className="min-w-16 shrink-0 rounded border border-[#c3c6d5]/60 bg-white py-1 pr-0.5 pl-1 text-[11px] text-[#001f2a] focus:border-[#003d92] focus:outline-none"
                    onChange={e => updateRow(i, { source: e.target.value })}
                  >
                    {availableSources.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <input
                    value={row.slug}
                    type="text"
                    placeholder="slug"
                    className="min-w-0 flex-1 rounded border border-[#c3c6d5]/60 bg-white px-1.5 py-1 text-[11px] text-[#001f2a] focus:border-[#003d92] focus:outline-none"
                    onChange={e => updateRow(i, { slug: e.target.value })}
                  />
                  <div className="flex shrink-0 flex-col">
                    <button
                      type="button"
                      className="flex h-3.5 w-5 cursor-pointer items-center justify-center text-[#003d92] disabled:cursor-default disabled:opacity-25"
                      disabled={i === 0}
                      onClick={() => moveIcon(i, -1)}
                    >
                      <span className="material-symbols-outlined text-base leading-none">
                        arrow_drop_up
                      </span>
                    </button>
                    <button
                      type="button"
                      className="flex h-3.5 w-5 cursor-pointer items-center justify-center text-[#003d92] disabled:cursor-default disabled:opacity-25"
                      disabled={i === iconRows.length - 1}
                      onClick={() => moveIcon(i, 1)}
                    >
                      <span className="material-symbols-outlined text-base leading-none">
                        arrow_drop_down
                      </span>
                    </button>
                  </div>
                  <button
                    type="button"
                    title="刪除此來源"
                    className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-red-500 transition hover:bg-red-50"
                    onClick={() => removeIconRow(i)}
                  >
                    <span className="material-symbols-outlined text-base">
                      close
                    </span>
                  </button>
                </div>
              ))}

              {!iconRows.length && (
                <p className="px-1 py-2 text-center text-[11px] text-[#434653]/60">
                  尚無圖示來源，按下方「新增來源」。
                </p>
              )}
            </div>

            <button
              type="button"
              className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1 rounded-lg border border-dashed border-[#c3c6d5] py-1.5 text-[11px] font-bold text-[#003d92] transition hover:bg-[#f4faff]"
              onClick={addIconRow}
            >
              <span className="material-symbols-outlined text-sm">add</span>
              新增來源
            </button>

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold text-[#434653] transition hover:bg-[#f4faff]"
                onClick={closeIconEditor}
              >
                取消
              </button>
              <button
                type="button"
                className="flex cursor-pointer items-center gap-1 rounded-lg bg-[#003d92] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#1654b9] disabled:opacity-50"
                disabled={updateIconSlugs.isPending}
                onClick={saveIconOrder}
              >
                {updateIconSlugs.isPending && (
                  <span className="material-symbols-outlined animate-spin text-sm">
                    progress_activity
                  </span>
                )}
                儲存
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
