import { useJobActiveFilterChips } from '../hooks/useJobActiveFilterChips';
import { JobFilterChip } from './JobFilterChip';

interface JobActiveFiltersProps {
  onClearAll: () => void;
}

// Active filter chip bar (task 7.5), ported from JobActiveFilters.vue.
export function JobActiveFilters({ onClearAll }: JobActiveFiltersProps) {
  const { chips, itemCount } = useJobActiveFilterChips();

  if (!chips.length) return null;

  return (
    <section className="mb-4 rounded-xl bg-white p-4 shadow-[0_24px_40px_rgba(0,31,42,0.06)]">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-[0.15em] text-[#434653]">
          目前篩選條件・{itemCount} 項
        </span>
        <button
          type="button"
          className="cursor-pointer text-xs font-bold text-[#003d92] hover:underline"
          onClick={onClearAll}
        >
          清除全部
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map(chip => (
          <JobFilterChip key={chip.key} chip={chip} />
        ))}
      </div>
    </section>
  );
}
