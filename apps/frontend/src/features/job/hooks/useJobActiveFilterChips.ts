import { useMemo, useState } from 'react';

import { useTechsQuery } from '../../keyword/queries';
import { useKeywordFilterStore } from '../../keyword/keywordFilterStore';
import { deriveLocationChipGroups } from '../deriveLocationChipGroups';
import { useJobFilterStore } from '../jobFilterStore';
import { jobLocationDistrictLabel } from '../locationCountyGroups';
import { useLocationGroupsQuery } from '../queries';

export type ChipKind =
  | 'include'
  | 'exclude'
  | 'operator'
  | 'salary'
  | 'location'
  | 'search';

export interface Chip {
  key: string;
  group: string;
  label: string;
  kind: ChipKind;
  remove: () => void;
  // County summary chips only: toggles the inline breakdown of their
  // individual districts (依縣市包起來 + 點擊查看完整各區並取消勾選).
  toggleExpand?: () => void;
  expanded?: boolean;
  // Marks chips rendered as a county's expanded district breakdown, so they
  // can be styled as nested/children of the summary chip above them.
  nested?: boolean;
}

// Builds the JobActiveFilters chip list + a stable item count, extracted out
// of the component (task: keep components under the 200-line limit) so the
// component itself only handles rendering.
export function useJobActiveFilterChips() {
  const { data: techs = [] } = useTechsQuery();
  const { data: locationGroups = [] } = useLocationGroupsQuery();
  const [expandedCounties, setExpandedCounties] = useState<Set<string>>(
    new Set(),
  );

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
    () => Object.fromEntries(techs.map(g => [g.tech, g.label])),
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

  const locationGroupsList = useMemo(
    () => deriveLocationChipGroups(selectedLocations, locationGroups),
    [selectedLocations, locationGroups],
  );

  const toggleCountyExpand = (county: string) => {
    setExpandedCounties(prev => {
      const next = new Set(prev);
      if (next.has(county)) next.delete(county);
      else next.add(county);
      return next;
    });
  };

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
    for (const group of locationGroupsList) {
      if (group.type === 'standalone') {
        list.push({
          key: `loc-${group.location}`,
          group: '地區',
          label: group.location,
          kind: 'location',
          remove: () =>
            setSelectedLocations(
              selectedLocations.filter(l => l !== group.location),
            ),
        });
        continue;
      }

      const isExpanded = expandedCounties.has(group.county);
      list.push({
        key: `county-${group.county}`,
        group: '地區',
        label: `${group.county}${group.isFull ? '全區' : '部分區'}`,
        kind: 'location',
        remove: () =>
          setSelectedLocations(
            selectedLocations.filter(l => !group.districtIds.includes(l)),
          ),
        toggleExpand: () => toggleCountyExpand(group.county),
        expanded: isExpanded,
      });

      if (isExpanded) {
        for (const districtId of group.districtIds) {
          list.push({
            key: `loc-${districtId}`,
            group: '',
            label: jobLocationDistrictLabel(districtId),
            kind: 'location',
            remove: () =>
              setSelectedLocations(
                selectedLocations.filter(l => l !== districtId),
              ),
            nested: true,
          });
        }
      }
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
  }, [
    searchText,
    companyFilters,
    selectedTags,
    excludedTags,
    keywordOperator,
    selectedLocations,
    locationGroupsList,
    expandedCounties,
    salaryFilter,
    salaryAmountLabel,
    groupLabelMap,
  ]);

  // Counts one item per filter concept (each county summary counts as 1,
  // regardless of expand state) so the badge doesn't fluctuate when a user
  // merely expands/collapses a county's district breakdown.
  const itemCount =
    (searchText ? 1 : 0) +
    companyFilters.length +
    selectedTags.length +
    (selectedTags.length > 1 && keywordOperator === 'or' ? 1 : 0) +
    excludedTags.length +
    locationGroupsList.length +
    (salaryFilter !== 'none' ? 1 : 0) +
    (salaryAmountLabel ? 1 : 0);

  return { chips, itemCount };
}
