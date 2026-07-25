import { TechIcon } from '../../../components/TechIcon';
import { InfoHint } from '../../methodology/components/InfoHint';
import type {
  CategoryGroup,
  CategoryTechRow,
} from '../hooks/useRegionTechCategoryRanking';

export interface RegionTechCategoryListProps {
  /**
   * 依分類分桶、每個分類最多 5 筆、已依 job_count 排序的技術排行
   * （`useRegionTechCategoryRanking`，task 16.2）。空分類已由該 hook 排除
   * （Requirement 5.5），此元件不需再自行過濾。
   */
  categoryGroups: CategoryGroup[];
  /** 點擊某一列技術時呼叫，帶出該列的 `tech` id（Requirement 6.3）。 */
  onSelectTech: (techId: string) => void;
}

// 圓餅圖固定色序（dataviz 分類色盤前 5 格，已通過色盲/對比驗證的既定順序；
// 顏色依名次固定指派，不依技術本身，因此同分類內第 N 名永遠是同一色）。
const PIE_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'];

const PIE_VIEWBOX = 100;
const PIE_RADIUS = 46;
const PIE_CENTER = PIE_VIEWBOX / 2;

/** 極座標（12 點鐘方向起順時針的比例位置 0..1）轉圓周上的直角座標。 */
function pointOnCircle(fraction: number): [number, number] {
  const angle = fraction * 2 * Math.PI - Math.PI / 2;
  return [
    PIE_CENTER + PIE_RADIUS * Math.cos(angle),
    PIE_CENTER + PIE_RADIUS * Math.sin(angle),
  ];
}

/** 各列在圓餅圖上的切片比例區間（分母為列出各列的職缺數加總）。 */
function buildSlices(rows: CategoryTechRow[]) {
  const total = rows.reduce((sum, row) => sum + row.jobCount, 0);
  let acc = 0;
  return rows.map((row, index) => {
    const start = acc / total;
    acc += row.jobCount;
    const end = acc / total;
    return { row, index, start, end };
  });
}

/**
 * 單一分類的圓餅圖。占比一律是「列出的前幾名彼此之間」的比例（分母為列出
 * 各列的職缺數加總，非該分類全部技術），與 InfoHint
 * （`locationMap.techRanking`）中的說明一致。
 *
 * 切片間以白色描邊隔出縫隙（Modal 背景為白色），確保相鄰切片在色覺辨認
 * 困難時仍分得開；旁邊的技術排行列（名稱+數字）為主要識別管道，顏色只是
 * 輔助。
 */
function CategoryPie({
  slices,
  onSelectTech,
}: {
  slices: ReturnType<typeof buildSlices>;
  onSelectTech: (techId: string) => void;
}) {
  return (
    <svg
      viewBox={`0 0 ${PIE_VIEWBOX} ${PIE_VIEWBOX}`}
      role="img"
      aria-label="前幾名技術職缺數占比圓餅圖"
      className="h-28 w-28 shrink-0"
      data-testid="region-tech-pie"
    >
      {slices.map(({ row, index, start, end }) => {
        const percent = Math.round((end - start) * 100);
        const title = `${row.label}：${row.jobCount.toLocaleString()} 筆（${percent}%）`;
        const shared = {
          'data-tech': row.tech,
          'data-testid': 'region-tech-pie-slice',
          fill: PIE_COLORS[index],
          stroke: '#ffffff',
          strokeWidth: 2,
          className: 'cursor-pointer',
          onClick: () => onSelectTech(row.tech),
        } as const;

        // 只有一片（或占比 100%）時 arc 起迄點重合會畫不出東西，退化為整圓。
        if (end - start >= 1) {
          return (
            <circle key={row.tech} {...shared} cx={PIE_CENTER} cy={PIE_CENTER} r={PIE_RADIUS}>
              <title>{title}</title>
            </circle>
          );
        }

        const [x1, y1] = pointOnCircle(start);
        const [x2, y2] = pointOnCircle(end);
        const largeArc = end - start > 0.5 ? 1 : 0;
        const d = `M ${PIE_CENTER} ${PIE_CENTER} L ${x1} ${y1} A ${PIE_RADIUS} ${PIE_RADIUS} 0 ${largeArc} 1 ${x2} ${y2} Z`;

        return (
          <path key={row.tech} {...shared} d={d}>
            <title>{title}</title>
          </path>
        );
      })}
    </svg>
  );
}

/**
 * 地區摘要 popup 內的技術分類排行區塊（task 17.2，design.md
 * 「`components/RegionTechCategoryList.tsx`」／requirements.md 5.4, 5.5,
 * 6.3）。
 *
 * 純展示型元件：不呼叫任何 hook 或查詢，`categoryGroups` 完全由呼叫端
 * （`RegionSummaryPopup`，透過 `useRegionTechCategoryRanking`）算好傳入。
 *
 * 依分類垂直堆疊（Requirement 5.7：避免橫向並排多欄在窄螢幕造成溢出），
 * 每個分類一個標題（附 `locationMap.techRanking` InfoHint 說明排行與占比
 * 的計算方式）+ 圓餅圖（前幾名職缺數占比）+ 技術排行列（依使用者要求維持
 * tech item 列表樣式：名次色塊 + `TechIcon` + label + 職缺數 + 占比，
 * 色塊顏色對應圓餅圖切片）。不提供檢視切換——圓餅圖與列表同時呈現。
 *
 * `categoryGroups` 為空陣列（無任何技術資料）時不渲染任何內容——
 * Requirement 5.6 的整體無資料狀態訊息由呼叫端 `RegionSummaryPopup`
 * （task 17.3）負責顯示，本元件在該情境下單純不掛載。
 */
export function RegionTechCategoryList({
  categoryGroups,
  onSelectTech,
}: RegionTechCategoryListProps) {
  return (
    <div className="flex flex-col gap-4">
      {categoryGroups.map(group => {
        const slices = buildSlices(group.rows);

        return (
          <div key={group.category} className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold tracking-[0.15em] text-[#434653]">
                {group.label}
              </span>
              <InfoHint
                metric="locationMap.techRanking"
                ariaLabel="查看技術排行如何計算"
              />
            </div>

            <div className="flex items-center gap-3">
              <CategoryPie slices={slices} onSelectTech={onSelectTech} />

              <ul className="flex min-w-0 flex-1 flex-col">
                {slices.map(({ row, index, start, end }) => (
                  <li
                    key={row.tech}
                    data-tech={row.tech}
                    data-testid="region-tech-row"
                    onClick={() => onSelectTech(row.tech)}
                    className="flex cursor-pointer items-center gap-2 border-b border-[#eef3f8] py-1.5 transition-colors last:border-0 hover:bg-[#f4faff]"
                  >
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                      style={{ backgroundColor: PIE_COLORS[index] }}
                    />
                    <TechIcon slugs={row.iconSlugs} label={row.label} size={18} />
                    <span className="min-w-0 flex-1 truncate text-sm font-black text-[#001f2a]">
                      {row.label}
                    </span>
                    <span className="text-sm font-black text-[#003d92] tabular-nums">
                      {row.jobCount.toLocaleString()}
                    </span>
                    <span className="w-9 text-right text-xs text-[#434653] tabular-nums">
                      {Math.round((end - start) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );
}
