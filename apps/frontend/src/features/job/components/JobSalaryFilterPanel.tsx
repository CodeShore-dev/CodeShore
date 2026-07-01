import { useEffect, useState } from 'react';

import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { InfoHint } from '../../methodology/components/InfoHint';
import { useJobFilterStore } from '../jobFilterStore';

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

// Salary filter section, extracted from JobFilterSidebar to keep that file
// under the 200-line component limit. The amount debounce keeps its own
// local-state handling (rather than the shared useDebouncedStoreSync hook)
// because the store value is unit-converted through a type-dependent
// multiplier before comparison — a transform the generic hook doesn't model.
export function JobSalaryFilterPanel() {
  const salaryFilter = useJobFilterStore(s => s.salaryFilter);
  const salaryAmount = useJobFilterStore(s => s.salaryAmount);
  const setSalaryFilter = useJobFilterStore(s => s.setSalaryFilter);
  const setSalaryAmount = useJobFilterStore(s => s.setSalaryAmount);

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

  return (
    <>
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
    </>
  );
}
