import { useMemo } from 'react';

import { useTechsQuery } from '../../keyword/queries';
import { useCompanyFilterStore } from '../companyFilterStore';
import { useCompanyTechFilterStore } from '../companyTechFilterStore';

type ChipKind = 'include' | 'exclude' | 'operator';

interface Chip {
  key: string;
  group: string;
  label: string;
  kind: ChipKind;
  remove: () => void;
}

const chipClass: Record<ChipKind, string> = {
  include: 'bg-[#003d92] text-white',
  exclude: 'bg-[#ba1a1a] text-white',
  operator: 'bg-[#003d92]/15 text-[#003d92]',
};

interface CompanyActiveFiltersProps {
  onClearAll: () => void;
}

// Active filter chip bar for the company page, mirroring JobActiveFilters:
// summarizes the current company-name and technology filters with per-chip
// removal plus a clear-all action.
export function CompanyActiveFilters({
  onClearAll,
}: CompanyActiveFiltersProps) {
  const { data: techs = [] } = useTechsQuery();

  const companyFilters = useCompanyFilterStore(s => s.companyFilters);
  const removeCompanyFilter = useCompanyFilterStore(
    s => s.removeCompanyFilter,
  );

  const selectedTags = useCompanyTechFilterStore(s => s.selectedTags);
  const excludedTags = useCompanyTechFilterStore(s => s.excludedTags);
  const keywordOperator = useCompanyTechFilterStore(s => s.keywordOperator);
  const setSelectedTags = useCompanyTechFilterStore(s => s.setSelectedTags);
  const setExcludedTags = useCompanyTechFilterStore(s => s.setExcludedTags);
  const setOperator = useCompanyTechFilterStore(s => s.setOperator);

  const techLabelMap = useMemo(
    () => Object.fromEntries(techs.map(t => [t.tech, t.label])),
    [techs],
  );
  const techLabel = (tech: string) => techLabelMap[tech] ?? tech;

  const chips = useMemo<Chip[]>(() => {
    const list: Chip[] = [];

    for (const entry of companyFilters) {
      list.push({
        key: `company-${entry.name}`,
        group: entry.mode === 'exclude' ? '排除公司' : '公司',
        label: entry.name,
        kind: entry.mode,
        remove: () => removeCompanyFilter(entry.name),
      });
    }
    for (const tag of selectedTags) {
      list.push({
        key: `inc-${tag}`,
        group: '技術',
        label: techLabel(tag),
        kind: 'include',
        remove: () => setSelectedTags(selectedTags.filter(t => t !== tag)),
      });
    }
    if (selectedTags.length > 1 && keywordOperator === 'or') {
      list.push({
        key: 'operator',
        group: '技術邏輯',
        label: '符合任一',
        kind: 'operator',
        remove: () => setOperator('and'),
      });
    }
    for (const tag of excludedTags) {
      list.push({
        key: `exc-${tag}`,
        group: '排除技術',
        label: techLabel(tag),
        kind: 'exclude',
        remove: () => setExcludedTags(excludedTags.filter(t => t !== tag)),
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyFilters, selectedTags, excludedTags, keywordOperator, techLabelMap]);

  if (!chips.length) return null;

  return (
    <section className="mb-4 rounded-xl bg-white p-4 shadow-[0_24px_40px_rgba(0,31,42,0.06)]">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-[0.15em] text-[#434653]">
          目前篩選條件・{chips.length} 項
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
          <span
            key={chip.key}
            className={`flex items-center gap-1 rounded-md py-0.5 pr-1 pl-2 text-xs font-bold ${chipClass[chip.kind]}`}
          >
            <span className="opacity-60">{chip.group}</span>
            <span>{chip.label}</span>
            <button
              type="button"
              className="flex cursor-pointer items-center rounded transition-opacity hover:opacity-70"
              title={`移除 ${chip.group}：${chip.label}`}
              onClick={chip.remove}
            >
              <span className="material-symbols-outlined text-sm! leading-none">
                close
              </span>
            </button>
          </span>
        ))}
      </div>
    </section>
  );
}
