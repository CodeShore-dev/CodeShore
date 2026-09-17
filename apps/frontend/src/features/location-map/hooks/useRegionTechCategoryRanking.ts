import { useMemo } from 'react';

import { useTechsQuery } from '../../keyword/queries';
import { CATEGORY_LABEL_MAP, CATEGORY_PRIORITY } from '../../../utils/constants';
import { useLocationTechStatsQuery } from '../queries';
import { groupByCounty } from '../utils/regionId';

/**
 * `useRegionTechCategoryRanking` 的回傳型別（task 16.2，design.md
 * 「`useRegionTechCategoryRanking`（Hook Contract）」，TypeScript 介面照抄
 * 設計文件）。
 */
export interface CategoryTechRow {
  tech: string;
  label: string;
  iconSlugs: string[] | null;
  jobCount: number;
}

export interface CategoryGroup {
  category: string;
  label: string; // CATEGORY_LABEL_MAP 查表
  rows: CategoryTechRow[]; // 已依 jobCount 排序，最多 5 筆
}

/** `mv_location_tech` 一列的最小形狀（`SupabaseView.MvLocationTech`）。 */
interface LocationTechRow {
  location: string | null;
  tech: string | null;
  job_count: number | null;
}

/** 技術目錄一列的最小形狀（`SupabaseView.MvTech`，`useTechsQuery` 回傳）。 */
interface TechCatalogRow {
  tech: string | null;
  label: string | null;
  category: string | null;
  icon_slugs: string[] | null;
}

/** 沒有任何分類鍵時的統一 fallback 分類鍵，對應 `CATEGORY_LABEL_MAP.others`。 */
const FALLBACK_CATEGORY = 'others';

/**
 * 依 `tech` 加總 `job_count`（同一 `tech` 可能出現在多筆列中——鄉鎮市區層
 * 理論上每個 `tech` 只有一列，但縣市層一定會有多筆〔同一技術出現在該縣市
 * 底下多個鄉鎮市區〕，這裡統一處理，不分兩套邏輯）。忽略 `tech` 為 `null`
 * 的列（無法歸類）。
 */
function sumJobCountByTech(rows: readonly LocationTechRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!row.tech) {
      continue;
    }
    const prev = totals.get(row.tech) ?? 0;
    totals.set(row.tech, prev + (row.job_count ?? 0));
  }
  return totals;
}

/**
 * 讀取該地區依技術分類拆分的職缺排行（task 16.2，design.md
 * 「`useRegionTechCategoryRanking`（Hook Contract）」／「技術分類聚合
 * （前端執行期，重用既有資料）」）。
 *
 * 鄉鎮市區層：`useLocationTechStatsQuery({ location: { eq: regionId } })`
 * 直接取得該地區的全部技術列（`to: -1`，不像 `RegionDetailPanel` 舊版那樣
 * 裁切為 Top 10 —— 分類分桶前若先裁切，可能讓原本能排進「自己分類前 5 名」
 * 的技術，因為跨分類的排序而被提早濾掉）。
 *
 * 縣市層：`useLocationTechStatsQuery({}, { to: -1 })` 全量抓取後，透過
 * `groupByCounty`（與 `useRegionSalaryStats`/`useRegionValueMaps` 相同的
 * 「全量抓取 + `groupByCounty`」既有策略）取出該縣市底下所有鄉鎮市區的列，
 * 同一技術若出現在多個鄉鎮市區則加總 `job_count`（不能只取其中一筆）。
 *
 * 這兩個查詢呼叫在每次 render 都無條件發生（React hook 規則不允許依 `tier`
 * 條件式呼叫），但個別用 `enabled` 依 `tier` 開關——不相關的那個呼叫不會真的
 * 觸發網路請求（TanStack Query 的 `enabled: false`），且與同頁面其他呼叫端
 * 共用相同的 queryKey 快取。
 *
 * 技術目錄合併：透過 `useTechsQuery()`（`mv_tech`）取得每個技術的
 * `category`/`label`/`icon_slugs`，與上方依技術加總後的 `job_count` 在前端
 * join（不新增後端聚合視圖，design.md「技術分類聚合」段落明訂）。
 *
 * 分類與排序：依 `CATEGORY_PRIORITY` 排序（不在其中的分類鍵排在所有已知
 * 分類之後，不因此拋錯或漏資料），同分類內依加總後的 `job_count` 由大到小
 * 排序並取前 5 名；沒有任何職缺的分類（分桶後為空）不出現在結果中。
 *
 * 資料異常的判斷取捨（比照 `useRegionSalaryStats` 對資料異常情境的處理，
 * 於程式註解中明確記錄）：一個技術若在技術目錄中完全查無對應項目
 * （理論上不應發生），或其 `category` 為 `null`，兩者都歸入統一的
 * `'others'`（`CATEGORY_LABEL_MAP` 既有的「其他」鍵）分類，而不是靜默捨棄
 * 這筆職缺數——沒有目錄項目時仍以技術 id 本身作為顯示用 `label`、
 * `iconSlugs` 則為 `null`（比照 `RegionDetailPanel` 既有的
 * `meta?.label ?? techId` fallback 慣例）。
 */
export function useRegionTechCategoryRanking(
  regionId: string | null,
  tier: 'county' | 'district',
): CategoryGroup[] {
  const { data: districtRows } = useLocationTechStatsQuery(
    { location: { eq: regionId ?? '' } },
    { to: -1, enabled: tier === 'district' && regionId != null },
  );

  const { data: countyAllRows } = useLocationTechStatsQuery(
    {},
    { to: -1, enabled: tier === 'county' && regionId != null },
  );

  const { data: techCatalog } = useTechsQuery();

  return useMemo(() => {
    if (!regionId) {
      return [];
    }

    const relevantRows: readonly LocationTechRow[] =
      tier === 'district'
        ? ((districtRows as LocationTechRow[] | undefined) ?? [])
        : (groupByCounty(
            ((countyAllRows as LocationTechRow[] | undefined) ?? []).filter(
              (row): row is LocationTechRow & { location: string } =>
                row.location != null,
            ),
          ).get(regionId) ?? []);

    const jobCountByTech = sumJobCountByTech(relevantRows);

    const catalogByTech = new Map<string, TechCatalogRow>();
    for (const row of (techCatalog as TechCatalogRow[] | undefined) ?? []) {
      if (row.tech) {
        catalogByTech.set(row.tech, row);
      }
    }

    const buckets = new Map<string, CategoryTechRow[]>();
    for (const [tech, jobCount] of jobCountByTech) {
      if (jobCount <= 0) {
        // Requirement: a tech row with job_count === 0 must not
        // create/populate a category bucket.
        continue;
      }

      const meta = catalogByTech.get(tech);
      const category = meta?.category ?? FALLBACK_CATEGORY;
      const row: CategoryTechRow = {
        tech,
        label: meta?.label ?? tech,
        iconSlugs: meta?.icon_slugs ?? null,
        jobCount,
      };

      const bucket = buckets.get(category);
      if (bucket) {
        bucket.push(row);
      } else {
        buckets.set(category, [row]);
      }
    }

    return [...buckets.entries()]
      .map(([category, rows]) => ({
        category,
        label: CATEGORY_LABEL_MAP[category] ?? CATEGORY_LABEL_MAP[FALLBACK_CATEGORY],
        rows: [...rows].sort((a, b) => b.jobCount - a.jobCount).slice(0, 5),
      }))
      .filter(group => group.rows.length > 0)
      .sort(
        (a, b) =>
          (CATEGORY_PRIORITY[a.category] ?? Number.MAX_SAFE_INTEGER) -
          (CATEGORY_PRIORITY[b.category] ?? Number.MAX_SAFE_INTEGER),
      );
  }, [regionId, tier, districtRows, countyAllRows, techCatalog]);
}
