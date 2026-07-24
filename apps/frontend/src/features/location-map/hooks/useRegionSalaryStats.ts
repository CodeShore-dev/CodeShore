import { useMemo } from 'react';

import { useLocationSalaryStatsQuery } from '../queries';
import { groupByCounty } from '../utils/regionId';

/**
 * `useRegionSalaryStats` 的回傳型別（task 16.1，design.md
 * 「`useRegionSalaryStats`（Hook Contract）」，TypeScript 介面照抄設計文件）。
 */
export interface SalaryTypeStat {
  jobCount: number;
  /** 該薪資型態下無任何開放中職缺時為 null（Requirement 5.3：仍需顯示 0 筆，
   *  但「代表薪資」在没有樣本時不應顯示為誤導性的 0）。*/
  avgSalary: number | null;
}

export interface RegionSalaryStats {
  month: SalaryTypeStat;
  year: SalaryTypeStat;
}

const ZERO_STAT: SalaryTypeStat = { jobCount: 0, avgSalary: null };
const ZERO_STATS: RegionSalaryStats = { month: ZERO_STAT, year: ZERO_STAT };

/**
 * `mv_location_salary` 一列的最小形狀（`SupabaseView.MvLocationSalary`）。
 * 型別上 `job_count`/`avg_salary` 因 `NonNull<Row>` 包裝而顯示為
 * 非可空的 `number`，但這裡刻意仍以可空型別接受（`number | null`），
 * 對執行期實際值做防禦性處理而非只信任型別宣告 —— 物化視圖裡 `avg_salary`
 * 是 `avg()` 聚合的衍生欄位，理論上「該薪資型態下所有列的薪資推估都是
 * NULL」時聚合結果仍可能是 NULL，即便 `job_count > 0`（見下方加權平均計算
 * 中對此資料異常情境的處理）。
 */
interface LocationSalaryRow {
  location: string | null;
  salary_type: string | null;
  job_count: number | null;
  avg_salary: number | null;
}

/**
 * 依薪資型態（`'month'` / `'year'`）分別加總 `job_count` 並計算以各列
 * `job_count` 加權的平均薪資（design.md 明訂公式：
 * `Σ(avg_salary × job_count) ÷ Σjob_count`）。
 *
 * 資料異常的判斷取捨（task brief 明確要求以程式註解記錄）：若某列
 * `job_count > 0` 但 `avg_salary` 為 `null`（理論上不應發生，但物化視圖的
 * `avg()` 聚合欄位在型別上無法完全排除這個可能性），該列的 `job_count`
 * 仍計入該薪資型態的職缺數總計（因為「總計」代表的是實際開放中職缺數，
 * 與能否算出代表薪資無關），但不計入加權平均的分子/分母 —— 也就是直接跳過
 * 該列的加權平均貢獻，而不是把它當成 0 薪資拉低平均，也不是把它當成 0
 * 職缺數而低估總計。
 */
function aggregateSalaryType(
  rows: readonly LocationSalaryRow[],
  salaryType: 'month' | 'year',
): SalaryTypeStat {
  let jobCount = 0;
  let weightedSum = 0;
  let weightSum = 0;

  for (const row of rows) {
    if (row.salary_type !== salaryType) {
      continue;
    }

    const rowJobCount = row.job_count ?? 0;
    jobCount += rowJobCount;

    if (row.avg_salary == null) {
      // Data anomaly: job_count contributes to the total above, but is
      // skipped here so it doesn't silently drag the weighted average
      // toward 0.
      continue;
    }

    weightedSum += row.avg_salary * rowJobCount;
    weightSum += rowJobCount;
  }

  if (jobCount === 0) {
    return { jobCount: 0, avgSalary: null };
  }

  return {
    jobCount,
    avgSalary: weightSum > 0 ? weightedSum / weightSum : null,
  };
}

/**
 * 讀取該地區的月薪／年薪職缺數與代表薪資（task 16.1，design.md
 * 「`useRegionSalaryStats`（Hook Contract）」）。
 *
 * 鄉鎮市區層：直接從全量 `mv_location_salary` 列中取出 `location === regionId`
 * 的列，依薪資型態分桶（至多 2 列：月薪／年薪各一，物化視圖的
 * `(location, salary_type)` 唯一索引保證）。
 *
 * 縣市層：透過 `groupByCounty`（與 `useRegionValueMaps.countyValues` 相同的
 * 「全量抓取 + `groupByCounty`」策略，design.md「未解問題/風險」已載明的既有
 * 慣例）取出該縣市底下所有列，依薪資型態分別加總 `job_count` 並計算加權平均。
 */
export function useRegionSalaryStats(
  regionId: string | null,
  tier: 'county' | 'district',
): RegionSalaryStats {
  const { data } = useLocationSalaryStatsQuery({}, { from: 0, to: -1 });

  return useMemo(() => {
    if (!regionId) {
      return ZERO_STATS;
    }

    const rows = (data ?? []) as readonly LocationSalaryRow[];

    const relevantRows =
      tier === 'district'
        ? rows.filter(row => row.location === regionId)
        : groupByCounty(
            rows.filter(
              (row): row is LocationSalaryRow & { location: string } =>
                row.location != null,
            ),
          ).get(regionId) ?? [];

    return {
      month: aggregateSalaryType(relevantRows, 'month'),
      year: aggregateSalaryType(relevantRows, 'year'),
    };
  }, [data, regionId, tier]);
}
