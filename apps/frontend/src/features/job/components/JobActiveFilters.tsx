import { useMemo } from 'react';

import { useTechsQuery } from '../../keyword/queries';
import { useKeywordFilterStore } from '../../keyword/keywordFilterStore';
import { useJobFilterStore } from '../jobFilterStore';

type ChipKind =
  | 'include'
  | 'exclude'
  | 'operator'
  | 'salary'
  | 'location'
  | 'search';

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
  salary: 'bg-[#003d92]/15 text-[#003d92]',
  location: 'bg-[#003d92]/15 text-[#003d92]',
  search: 'bg-[#003d92]/15 text-[#003d92]',
};

interface JobActiveFiltersProps {
  onClearAll: () => void;
}

// Active filter chip bar (task 7.5), ported from JobActiveFilters.vue.
export function JobActiveFilters({ onClearAll }: JobActiveFiltersProps) {
  const { data: techs = [] } = useTechsQuery();

  const searchText = useJobFilterStore(s => s.searchText);
  const companyFilters = useJobFilterStore(s => s.companyFilters);
  const salaryFilter = useJobFilterStore(s => s.salaryFilter);
  const salaryAmount = useJobFilterStore(s => s.salaryAmount);
  const selectedLocations = useJobFilterStore(s => s.selectedLocations);
  const setSearchText = useJobFilterStore(s => s.setSearchText);
  const removeCompanyFilter = useJobFilterStore(s => s.removeCompanyFilter);
  const setSalaryFilter = useJobFilterStore(s => s.setSalaryFilter);
  const setSalaryAmount = useJobFilterStore(s => s.setSalaryAmount);
  const setSelectedLocations = useJobFilterStore(s => s.setSelectedLocations);

  const selectedTags = useKeywordFilterStore(s => s.selectedTags);
  const excludedTags = useKeywordFilterStore(s => s.excludedTags);
  const keywordOperator = useKeywordFilterStore(s => s.keywordOperator);
  const setSelectedTags = useKeywordFilterStore(s => s.setSelectedTags);
  const setExcludedTags = useKeywordFilterStore(s => s.setExcludedTags);
  const setOperator = useKeywordFilterStore(s => s.setOperator);

  const groupLabelMap = useMemo(
    () =>
      Object.fromEntries(techs.map(g => [g.tech, g.label])),
    [techs],
  );
  const kwLabel = (tag: string) => groupLabelMap[tag] ?? tag;

  const salaryAmountLabel = useMemo<string | null>(() => {
    const { type, amount } = salaryAmount;
    if (!type) return null;
    const typeLabel = type === 'year' ? '年薪' : '月薪';
    if (amount === null) return `薪資類型：${typeLabel}`;
    const unit = type === 'year' ? '百萬' : '萬';
    const mult = type === 'year' ? 1_000_000 : 10_000;
    return `${typeLabel} ≥ ${amount / mult}${unit}`;
  }, [salaryAmount]);

  const chips = useMemo<Chip[]>(() => {
    const list: Chip[] = [];

    if (searchText) {
      list.push({
        key: 'search',
        group: '職缺',
        label: searchText,
        kind: 'search',
        remove: () => setSearchText(''),
      });
    }
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
        group: '技能',
        label: kwLabel(tag),
        kind: 'include',
        remove: () => setSelectedTags(selectedTags.filter(t => t !== tag)),
      });
    }
    if (selectedTags.length > 1 && keywordOperator === 'or') {
      list.push({
        key: 'operator',
        group: '技能邏輯',
        label: '符合任一',
        kind: 'operator',
        remove: () => setOperator('and'),
      });
    }
    for (const tag of excludedTags) {
      list.push({
        key: `exc-${tag}`,
        group: '排除技能',
        label: kwLabel(tag),
        kind: 'exclude',
        remove: () => setExcludedTags(excludedTags.filter(t => t !== tag)),
      });
    }
    for (const loc of selectedLocations) {
      list.push({
        key: `loc-${loc}`,
        group: '地區',
        label: loc,
        kind: 'location',
        remove: () =>
          setSelectedLocations(selectedLocations.filter(l => l !== loc)),
      });
    }
    if (salaryFilter !== 'none') {
      list.push({
        key: 'salaryFilter',
        group: '面議',
        label: salaryFilter === 'excluding' ? '排除面議' : '只要面議',
        kind: 'salary',
        remove: () => setSalaryFilter('none'),
      });
    }
    if (salaryAmountLabel) {
      list.push({
        key: 'salaryAmount',
        group: '薪資',
        label: salaryAmountLabel,
        kind: 'salary',
        remove: () => setSalaryAmount({ type: '', amount: null }),
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchText,
    companyFilters,
    selectedTags,
    excludedTags,
    keywordOperator,
    selectedLocations,
    salaryFilter,
    salaryAmountLabel,
    groupLabelMap,
  ]);

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
