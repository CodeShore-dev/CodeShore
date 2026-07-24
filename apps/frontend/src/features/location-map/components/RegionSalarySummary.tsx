import { toWan } from '../../../utils/format';
import type { SalaryTypeStat } from '../hooks/useRegionSalaryStats';

export interface RegionSalarySummaryProps {
  /** 該地區的月薪職缺數與代表薪資（`useRegionSalaryStats` 回傳的 `month`）。 */
  month: SalaryTypeStat;
  /** 該地區的年薪職缺數與代表薪資（`useRegionSalaryStats` 回傳的 `year`）。 */
  year: SalaryTypeStat;
}

/**
 * 地區摘要 popup 內的薪資概況區塊（task 17.1，design.md
 * 「`components/RegionSalarySummary.tsx`」／requirements.md 5.2, 5.3）。
 *
 * 純展示型元件：不呼叫任何 hook 或查詢，月薪／年薪兩種薪資型態各自的
 * `{ jobCount, avgSalary }` 完全由呼叫端（`RegionSummaryPopup`，透過
 * `useRegionSalaryStats`）算好傳入，並列呈現兩個區塊（Requirement 5.2：
 * 不得將兩種薪資型態合併計算成單一數值）。
 *
 * 代表薪資使用 `utils/format.ts` 的 `toWan`（萬元格式）呈現；`toWan` 本身
 * 在輸入為 `null`/`undefined` 時就回傳「—」，因此 `avgSalary` 為 `null`
 * （Requirement 5.3：該薪資型態沒有樣本時不應顯示誤導性的 0）會自然顯示
 * 「—」而非 0 或 NaN，不需要在這裡另外判斷。
 */
export function RegionSalarySummary({ month, year }: RegionSalarySummaryProps) {
  const blocks: Array<{ key: string; label: string; stat: SalaryTypeStat }> = [
    { key: 'month', label: '月薪', stat: month },
    { key: 'year', label: '年薪', stat: year },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {blocks.map(({ key, label, stat }) => (
        <div
          key={key}
          className="flex flex-col rounded-xl bg-[#f4faff] p-3"
        >
          <span className="text-xs font-bold tracking-wide text-[#434653]">
            {label}
          </span>
          <span className="mt-1 font-black tracking-[-0.03em] text-[#003d92] tabular-nums">
            {toWan(stat.avgSalary)}
          </span>
          <span className="mt-1 text-xs text-[#434653]">
            職缺數
            <span className="ml-1 font-bold text-[#001f2a] tabular-nums">
              {stat.jobCount.toLocaleString()}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
