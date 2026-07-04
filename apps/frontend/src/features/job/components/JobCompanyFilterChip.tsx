import { type CompanyFilterEntry } from '../jobFilterStore';

interface JobCompanyFilterChipProps {
  entry: CompanyFilterEntry;
  onToggleMode: () => void;
  onRemove: () => void;
}

// Single company filter chip: visually distinguishes include (blue, matches
// JobTechFilterPanel's selected style) vs exclude (red, matches the old
// exclude-only chip style) via mode-based color, and exposes a toggle
// control (swap icon) alongside the existing remove control (Req 4.2-4.4, 4.7).
export function JobCompanyFilterChip({
  entry,
  onToggleMode,
  onRemove,
}: JobCompanyFilterChipProps) {
  const { name, mode } = entry;
  const isInclude = mode === 'include';

  return (
    <span
      className={`flex items-center gap-1 rounded-md py-0.5 pr-1 pl-2 text-xs font-bold text-white ${
        isInclude ? 'bg-[#003d92]' : 'bg-[#ba1a1a]'
      }`}
    >
      <span>{name}</span>
      <button
        type="button"
        className="flex cursor-pointer items-center rounded transition-opacity hover:opacity-70"
        title={
          isInclude ? `切換為排除：${name}` : `切換為包含：${name}`
        }
        onClick={onToggleMode}
      >
        <span className="material-symbols-outlined text-sm! leading-none">
          swap_horiz
        </span>
      </button>
      <button
        type="button"
        className="flex cursor-pointer items-center rounded transition-opacity hover:opacity-70"
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
