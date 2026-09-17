import { Modal } from '../../../components/Modal';
import { InfoHint } from '../../methodology/components/InfoHint';
import { useRegionJobsNavigation } from '../hooks/useRegionJobsNavigation';
import { useRegionSalaryStats } from '../hooks/useRegionSalaryStats';
import { useRegionTechCategoryRanking } from '../hooks/useRegionTechCategoryRanking';
import { RegionSalarySummary } from './RegionSalarySummary';
import { RegionTechCategoryList } from './RegionTechCategoryList';

/**
 * 目前選定地區所屬的層級（task 17.3，design.md
 * `RegionSummaryPopup`（Props Contract））。鄉鎮市區層為葉節點，不提供下鑽。
 */
export type RegionSummaryTier = 'county' | 'district';

export interface RegionSummaryPopupProps {
  /** null 時 Modal 關閉（Requirement 5.9 的關閉狀態）。 */
  regionId: string | null;
  displayName: string;
  tier: RegionSummaryTier;
  /**
   * 呼叫端已算好的職缺總數（沿用既有 `RegionDetailPanel` 的口徑：一律來自
   * 職缺數資料，本元件不重複查詢——design.md `RegionSummaryPopup`
   * （Props Contract）明訂此欄位「呼叫端算好傳入、本元件不重複查詢」的
   * 責任劃分）。
   */
  totalJobCount: number;
  onClose: () => void;
  /** 僅縣市層提供；鄉鎮市區層為葉節點，不下鑽（Requirement 3.2）。 */
  onDrillDown?: () => void;
  /**
   * 僅鄉鎮市區層提供：目前下鑽所在的縣市名稱，用於組出「回到 XXX 分布」
   * 按鈕文字。與 `onReturnToCounty` 需成對提供才會顯示該按鈕。
   */
  parentCountyName?: string;
  /** 僅鄉鎮市區層提供：點擊「回到 XXX 分布」時觸發，返回該縣市的總覽層級。 */
  onReturnToCounty?: () => void;
}

/**
 * 地區摘要 popup（task 17.3，design.md「`RegionSummaryPopup`（Props
 * Contract）」／requirements.md 5.1, 5.6-5.9, 6.1-6.3）。取代舊有
 * `RegionDetailPanel.tsx`（task 18.2 才會實際刪除該檔案），包裹共用 `Modal`
 * 顯示地區名稱與開放中職缺總數，並組裝薪資概況（`RegionSalarySummary`）與
 * 依技術分類拆分的排行（`RegionTechCategoryList`）。
 *
 * 三個資料 hook（`useRegionSalaryStats`／`useRegionTechCategoryRanking`／
 * `useRegionJobsNavigation`）一律無條件呼叫（React hook 規則不允許依
 * `regionId`/`totalJobCount` 條件式呼叫）：`regionId` 為 `null` 時前兩者依
 * 各自的既有契約回傳零狀態／空陣列，不會因此拋錯或需要額外的 null 防呆；
 * `useRegionJobsNavigation` 要求非 null 的 `regionId: string`，這裡以
 * `regionId ?? ''` 餵入——`regionId` 為 `null` 時 `Modal` 的 `open` 已是
 * `false`（不渲染任何 children，見下方），因此傳入空字串不會被實際使用到。
 *
 * Requirement 5.6：`totalJobCount === 0` 時只渲染無資料說明，不掛載
 * `RegionSalarySummary`/`RegionTechCategoryList`（避免這兩個子元件在無資料
 * 時仍各自呈現誤導性的空狀態）。「查看此地區職缺」按鈕**不**收斂在
 * `hasJobs` 底下——Requirement 6.1/6.2 並未將該操作與職缺總數是否為 0 綁定
 * （比照既有 `RegionDetailPanel.tsx` 的既有慣例：該元件的「查看此地區職缺」
 * 按鈕同樣渲染在 `hasJobs` 條件式之外），因此無論職缺總數是否為 0，該按鈕
 * 皆無條件渲染。
 *
 * 「進入鄉鎮市區分布」按鈕（僅 `tier === 'county'` 時渲染）同樣刻意不受
 * `hasJobs` 影響：Requirement 3.2 的下鑽操作與職缺數無關，0 筆職缺的縣市
 * 仍應可下鑽查看其鄉鎮市區分布（縣市底下的個別鄉鎮市區仍可能各自有職缺，
 * 只是加總後掛零；即便真的全部為零，使用者仍應能檢視地理下鑽層級本身）。
 */
export function RegionSummaryPopup({
  regionId,
  displayName,
  tier,
  totalJobCount,
  onClose,
  onDrillDown,
  parentCountyName,
  onReturnToCounty,
}: RegionSummaryPopupProps) {
  const salaryStats = useRegionSalaryStats(regionId, tier);
  const categoryGroups = useRegionTechCategoryRanking(regionId, tier);
  const { goToJobs, goToJobsWithTech } = useRegionJobsNavigation(
    regionId ?? '',
    tier,
  );

  const hasJobs = totalJobCount > 0;
  const canReturnToCounty = tier === 'district' && !!parentCountyName && !!onReturnToCounty;

  return (
    <Modal open={!!regionId} title={displayName} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[#434653]">
          開放中職缺總數：
          <span className="ml-1 font-black text-[#003d92] tabular-nums">
            {totalJobCount.toLocaleString()}
          </span>
        </p>

        {/* 操作按鈕群組放在最上方，讓使用者不必先滑過薪資/技術排行才找得到
            跳轉與下鑽/返回操作。 */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={goToJobs}
            className="cursor-pointer rounded-lg bg-[#003d92] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1654b9] active:scale-95"
          >
            查看此地區職缺
          </button>

          {tier === 'county' && onDrillDown && (
            <button
              type="button"
              onClick={onDrillDown}
              className="cursor-pointer rounded-lg border border-[#003d92] px-4 py-2 text-sm font-bold text-[#003d92] transition hover:bg-[#f4faff] active:scale-95"
            >
              進入鄉鎮市區分布
            </button>
          )}

          {canReturnToCounty && (
            <button
              type="button"
              onClick={onReturnToCounty}
              className="cursor-pointer rounded-lg border border-[#003d92] px-4 py-2 text-sm font-bold text-[#003d92] transition hover:bg-[#f4faff] active:scale-95"
            >
              回到{parentCountyName}分布
            </button>
          )}
        </div>

        {!hasJobs ? (
          <p className="text-sm text-[#434653]">此地區目前沒有開放中職缺</p>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold tracking-wide text-[#434653]">
                薪資概況
              </span>
              <InfoHint metric="locationMap.salary" />
            </div>
            <RegionSalarySummary month={salaryStats.month} year={salaryStats.year} />
            <RegionTechCategoryList
              categoryGroups={categoryGroups}
              onSelectTech={goToJobsWithTech}
            />
          </>
        )}
      </div>
    </Modal>
  );
}
