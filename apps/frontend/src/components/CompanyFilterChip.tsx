// Company filter entry mode and shape (task 1.4). Defined locally here since
// this component owns the mode-based styling; the canonical location for
// these types is `features/company/companyFilterStore.ts`, which task 2.1
// will introduce. `CompanyFilterPanel.tsx` imports this type from here.
// `jobFilterStore.ts` keeps its own local definition until task 7.2 rewires
// the job feature to import from the canonical company location.
export type CompanyFilterMode = 'include' | 'exclude';

export interface CompanyFilterEntry {
  name: string;
  mode: CompanyFilterMode;
}

export interface CompanyFilterChipProps {
  entry: CompanyFilterEntry;
  onToggleMode: () => void;
  onRemove: () => void;
}

// Shared company filter chip presentation (task 1.4): visually distinguishes
// include (blue) vs exclude (red) via mode-based color, and exposes a toggle
// control (swap icon) alongside a remove control (Req 1.2-1.4, 1.7). Extracted
// from JobCompanyFilterChip to be fully props-driven, with no direct store
// access, so it can be reused by both the job and company pages (task 7.2,
// 2.2).
export function CompanyFilterChip({
  entry,
  onToggleMode,
  onRemove,
}: CompanyFilterChipProps) {
  const { name, mode } = entry;
  const isInclude = mode === 'include';

  return (
    <span
      className={`flex items-center gap-1 rounded-md py-1 pr-1 pl-2 text-xs font-bold text-white ${
        isInclude ? 'bg-[#003d92]' : 'bg-[#ba1a1a]'
      }`}
    >
      <button
        type="button"
        className="flex cursor-pointer items-center border-r border-white/30 rounded p-1 pr-1.5 transition-opacity hover:opacity-70"
        title={isInclude ? `切換為排除：${name}` : `切換為包含：${name}`}
        onClick={onToggleMode}
      >
        <span className="material-symbols-outlined text-sm! leading-none">
          swap_horiz
        </span>
      </button>
      <span className="px-1">{name}</span>
      <button
        type="button"
        className="flex cursor-pointer items-center rounded border-l border-white/30 p-1 pl-1.5 transition-opacity hover:opacity-70"
        title={`移除公司篩選：${name}`}
        onClick={onRemove}
      >
        <span className="material-symbols-outlined text-sm! leading-none">
          close
        </span>
      </button>
    </span>
  );
}
