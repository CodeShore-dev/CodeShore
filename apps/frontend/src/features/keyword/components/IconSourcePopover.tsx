import { createPortal } from 'react-dom';

import { TechIcon } from '../../../components/TechIcon';
import { previewSlugs, type useIconSourceEditor } from '../hooks/useIconSourceEditor';

interface IconSourcePopoverProps {
  editor: ReturnType<typeof useIconSourceEditor>;
  label: string;
  isSaving: boolean;
}

// Icon-source reorder popover (portal to body), extracted from TechCard to
// keep that component under the 200-line limit. Pure presentation over the
// useIconSourceEditor hook's state.
export function IconSourcePopover({ editor, label, isSaving }: IconSourcePopoverProps) {
  const {
    anchor,
    iconRows,
    popupRef,
    availableSources,
    close,
    moveIcon,
    addIconRow,
    removeIconRow,
    updateRow,
    save,
  } = editor;

  return createPortal(
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
            <TechIcon slugs={previewSlugs(row)} label={label} hideIfNotFound={false} />
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
              <span className="material-symbols-outlined text-base">close</span>
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
          onClick={close}
        >
          取消
        </button>
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 rounded-lg bg-[#003d92] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#1654b9] disabled:opacity-50"
          disabled={isSaving}
          onClick={save}
        >
          {isSaving && (
            <span className="material-symbols-outlined animate-spin text-sm">
              progress_activity
            </span>
          )}
          儲存
        </button>
      </div>
    </div>,
    document.body,
  );
}
