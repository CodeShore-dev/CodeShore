// Canonical CompanyFilterEntry/CompanyFilterMode type is defined in
// `features/company/companyFilterStore.ts`; re-exported here (type-only, no
// runtime coupling) so this shared component and `CompanyFilterPanel.tsx`
// have a single source of truth instead of a structurally-duplicated copy.
import type { CompanyFilterEntry } from '../features/company/companyFilterStore';

export type {
  CompanyFilterEntry,
  CompanyFilterMode,
} from '../features/company/companyFilterStore';

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
