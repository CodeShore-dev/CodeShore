import type { Chip, ChipKind } from '../hooks/useJobActiveFilterChips';

const chipClass: Record<ChipKind, string> = {
  include: 'bg-[#003d92] text-white',
  exclude: 'bg-[#ba1a1a] text-white',
  operator: 'bg-[#003d92]/15 text-[#003d92]',
  salary: 'bg-[#003d92]/15 text-[#003d92]',
  location: 'bg-[#003d92]/15 text-[#003d92]',
  search: 'bg-[#003d92]/15 text-[#003d92]',
};

interface JobFilterChipProps {
  chip: Chip;
}

// Single active-filter chip, extracted from JobActiveFilters (task: keep
// components under the 200-line limit). For county summary chips, the whole
// label doubles as the expand/collapse trigger (a big click target, instead
// of a tiny caret sitting right next to the remove button) and the remove
// (X) button is set off by a divider + extra margin, so an accidental tap
// aimed at "expand" can't land on "remove" (依縣市包起來 + 點擊查看完整各區
// 並取消勾選 + 避免誤觸移除按鈕).
export function JobFilterChip({ chip }: JobFilterChipProps) {
  return (
    <span
      className={`flex items-center gap-1 rounded-md py-0.5 pr-1 pl-2 text-xs font-bold ${chipClass[chip.kind]} ${chip.nested ? 'opacity-80' : ''}`}
    >
      {chip.nested && (
        <span className="material-symbols-outlined text-xs! leading-none opacity-70">
          subdirectory_arrow_right
        </span>
      )}
      {chip.group && <span className="opacity-60">{chip.group}</span>}
      {chip.toggleExpand ? (
        <button
          type="button"
          className="flex cursor-pointer items-center gap-0.5 rounded hover:underline"
          title={chip.expanded ? '收起各區' : '查看各區並取消勾選'}
          onClick={chip.toggleExpand}
        >
          <span>{chip.label}</span>
          <span className="material-symbols-outlined text-sm! leading-none">
            {chip.expanded ? 'expand_less' : 'expand_more'}
          </span>
        </button>
      ) : (
        <span>{chip.label}</span>
      )}
      <button
        type="button"
        className="ml-1 flex cursor-pointer items-center rounded border-l border-current/25 pl-1.5 transition-opacity hover:opacity-70"
        title={`移除 ${chip.group || '地區'}：${chip.label}`}
        onClick={chip.remove}
      >
        <span className="material-symbols-outlined text-sm! leading-none">
          close
        </span>
      </button>
    </span>
  );
}
