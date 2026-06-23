import { useEffect, useState } from 'react';

import { SearchInput } from '../../../components/SearchInput';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { InfoHint } from '../../methodology/components/InfoHint';
import { useJobFilterStore } from '../jobFilterStore';
import { useLocationGroupsQuery } from '../queries';
import { JobKeywordFilterPanel } from './JobKeywordFilterPanel';

type SalaryType = 'month' | 'year' | '';

function salaryMultiplier(type: SalaryType): number {
  if (type === 'year') return 1_000_000;
  if (type === 'month') return 10_000;
  return 1;
}

const SALARY_FILTER_OPTIONS = [
  { value: 'none', label: '無' },
  { value: 'excluding', label: '排除面議' },
  { value: 'only', label: '只要面議' },
] as const;

const SALARY_TYPE_OPTIONS = [
  { value: '', label: '不限' },
  { value: 'month', label: '月薪' },
  { value: 'year', label: '年薪' },
] as const;

// Job filter sidebar content (task 7.5), ported from JobFilterSidebar.vue.
// Debounced text/number inputs keep local state and only push to the filter
// store when the value actually changes (avoids spurious page resets when the
// store updates the input externally, e.g. via "clear all" or URL restore).
export function JobFilterSidebar() {
  const searchText = useJobFilterStore(s => s.searchText);
  const companySearchText = useJobFilterStore(s => s.companySearchText);
  const salaryFilter = useJobFilterStore(s => s.salaryFilter);
  const salaryAmount = useJobFilterStore(s => s.salaryAmount);
  const selectedLocations = useJobFilterStore(s => s.selectedLocations);
  const setSearchText = useJobFilterStore(s => s.setSearchText);
  const setCompanySearchText = useJobFilterStore(s => s.setCompanySearchText);
  const setSalaryFilter = useJobFilterStore(s => s.setSalaryFilter);
  const setSalaryAmount = useJobFilterStore(s => s.setSalaryAmount);
  const setSelectedLocations = useJobFilterStore(s => s.setSelectedLocations);

  const { data: locationGroups = [], isLoading: locationGroupsLoading } =
    useLocationGroupsQuery();

  // Debounced job title search.
  const [localSearch, setLocalSearch] = useState(searchText);
  const debouncedSearch = useDebouncedValue(localSearch, 400);
  useEffect(() => {
    if (debouncedSearch !== useJobFilterStore.getState().searchText) {
      setSearchText(debouncedSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);
  useEffect(() => {
    if (searchText !== localSearch) setLocalSearch(searchText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  // Debounced company search.
  const [localCompany, setLocalCompany] = useState(companySearchText);
  const debouncedCompany = useDebouncedValue(localCompany, 400);
  useEffect(() => {
    if (debouncedCompany !== useJobFilterStore.getState().companySearchText) {
      setCompanySearchText(debouncedCompany);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedCompany]);
  useEffect(() => {
    if (companySearchText !== localCompany) setLocalCompany(companySearchText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companySearchText]);

  // Debounced salary-amount (display value = stored amount / multiplier).
  const displayAmount =
    salaryAmount.amount !== null && salaryMultiplier(salaryAmount.type)
      ? salaryAmount.amount / salaryMultiplier(salaryAmount.type)
      : null;
  const [localSalaryAmount, setLocalSalaryAmount] = useState<number | null>(
    displayAmount,
  );
  const debouncedSalaryAmount = useDebouncedValue(localSalaryAmount, 500);
  useEffect(() => {
    const state = useJobFilterStore.getState();
    const type = state.salaryAmount.type;
    const nextAmount =
      debouncedSalaryAmount !== null
        ? debouncedSalaryAmount * salaryMultiplier(type)
        : null;
    if (nextAmount !== state.salaryAmount.amount) {
      setSalaryAmount({ type, amount: nextAmount });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSalaryAmount]);
  useEffect(() => {
    if (displayAmount !== localSalaryAmount) setLocalSalaryAmount(displayAmount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salaryAmount.amount, salaryAmount.type]);

  const onSalaryTypeChange = (type: SalaryType) => {
    const amount =
      localSalaryAmount !== null
        ? localSalaryAmount * salaryMultiplier(type)
        : salaryAmount.amount;
    setSalaryAmount({ type, amount });
  };

  const salaryUnitLabel =
    salaryAmount.type === 'year' ? '百萬' : salaryAmount.type === 'month' ? '萬' : '';

  const [locationSearch, setLocationSearch] = useState('');
  const filteredLocationGroups = (() => {
    const q = locationSearch.trim().toLowerCase();
    if (!q) return locationGroups;
    return locationGroups.filter(loc =>
      loc.location.toLowerCase().includes(q),
    );
  })();

  const toggleLocation = (location: string) => {
    setSelectedLocations(
      selectedLocations.includes(location)
        ? selectedLocations.filter(l => l !== location)
        : [...selectedLocations, location],
    );
  };

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <SearchInput
          value={localSearch}
          placeholder="搜尋職缺..."
          onChange={setLocalSearch}
        />
        <SearchInput
          value={localCompany}
          placeholder="搜尋公司名稱..."
          onChange={setLocalCompany}
        />
      </section>

      <JobKeywordFilterPanel />

      <section>
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-[0.15em] text-[#434653]">
          <span>地區</span>
          {selectedLocations.length > 0 && (
            <span className="rounded-full bg-[#003d92] px-1.5 py-px text-[9px] leading-none text-white">
              {selectedLocations.length}
            </span>
          )}
        </div>
        <div className="relative mb-3">
          <span className="material-symbols-outlined text-on-surface-variant pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base!">
            search
          </span>
          <input
            value={locationSearch}
            type="text"
            placeholder="搜尋地區..."
            className="border-surface-container-highest text-on-surface placeholder-on-surface-variant/50 bg-surface-container w-full rounded-lg border py-2 pr-8 pl-9 text-sm font-bold focus:outline-none"
            onChange={e => setLocationSearch(e.target.value)}
          />
          {locationSearch && (
            <button
              type="button"
              className="text-on-surface-variant hover:text-on-surface absolute top-1/2 right-2 flex -translate-y-1/2 cursor-pointer"
              onClick={() => setLocationSearch('')}
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          )}
        </div>
        {locationGroupsLoading ? (
          <div className="text-on-surface-variant text-xs">載入中...</div>
        ) : (
          <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
            {filteredLocationGroups.map(loc => (
              <span
                key={loc.location}
                className={`flex w-full cursor-pointer items-center justify-between rounded px-4 py-2 text-sm font-bold ${
                  selectedLocations.includes(loc.location)
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface-variant hover:bg-primary-container hover:text-on-primary'
                }`}
                onClick={() => toggleLocation(loc.location)}
              >
                <span>{loc.location}</span>
                <span className="flex items-center gap-1">
                  {selectedLocations.includes(loc.location) && (
                    <span className="material-symbols-outlined text-sm">
                      check
                    </span>
                  )}
                  <span>{loc.count}</span>
                </span>
              </span>
            ))}
            {!filteredLocationGroups.length && locationSearch && (
              <span className="text-on-surface-variant px-4 py-2 text-sm">
                沒有符合的地區
              </span>
            )}
          </div>
        )}
      </section>

      <section>
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-[0.15em] text-[#434653]">
          <span>面議薪資</span>
          <InfoHint metric="job.salary" />
          {salaryFilter !== 'none' && (
            <span className="size-1.5 rounded-full bg-[#003d92]" />
          )}
        </div>
        <div className="flex overflow-hidden rounded-lg border border-[#c3c6d5]">
          {SALARY_FILTER_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              className={`flex-1 cursor-pointer py-1.5 text-sm font-bold transition-colors ${
                salaryFilter === option.value
                  ? 'bg-[#003d92] text-white'
                  : 'bg-white text-[#434653] hover:bg-[#f4faff]'
              }`}
              onClick={() => setSalaryFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-[0.15em] text-[#434653]">
          <span>薪資下限</span>
          {(salaryAmount.type !== '' || salaryAmount.amount !== null) && (
            <span className="size-1.5 rounded-full bg-[#003d92]" />
          )}
        </div>
        <div className="flex overflow-hidden rounded-lg border border-[#c3c6d5]">
          {SALARY_TYPE_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              className={`flex-1 cursor-pointer py-1.5 text-sm font-bold transition-colors ${
                salaryAmount.type === option.value
                  ? 'bg-[#003d92] text-white'
                  : 'bg-white text-[#434653] hover:bg-[#f4faff]'
              }`}
              onClick={() => onSalaryTypeChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <input
            type="number"
            value={localSalaryAmount ?? ''}
            placeholder="最低薪資至少..."
            disabled={salaryAmount.type === ''}
            className={`w-full [appearance:textfield] rounded-lg border border-[#c3c6d5] bg-white py-2 pl-3 text-sm font-bold text-[#001f2a] placeholder-[#434653]/50 focus:border-[#003d92] focus:outline-none disabled:opacity-40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
              salaryUnitLabel ? 'pr-10' : 'pr-3'
            }`}
            onChange={e =>
              setLocalSalaryAmount(e.target.value ? Number(e.target.value) : null)
            }
          />
          {salaryUnitLabel && (
            <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-sm font-bold text-[#434653]">
              {salaryUnitLabel}
            </span>
          )}
          {localSalaryAmount !== null && (
            <button
              type="button"
              className="absolute top-1/2 right-8 flex -translate-y-1/2 cursor-pointer text-[#434653]/50 hover:text-[#434653]"
              onClick={() => {
                setLocalSalaryAmount(null);
                setSalaryAmount({ type: salaryAmount.type, amount: null });
              }}
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
