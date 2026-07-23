/**
 * 純函式：依當前資料集的最大值，將任一數值對應到固定階層的著色色票
 * （task 4.2，design.md「utils/colorScale.ts」，requirements 2.1, 2.2, 3.3,
 * 4.4：0 筆職缺一律以最淺色階呈現、著色隨數值單調變化）。
 *
 * 色階數：採用 6 階（choropleth 常見的 5–7 階範圍，design.md「未解問題」將
 * 具體階層數留給實作階段微調）。6 階在肉眼可辨識的色差與地圖上可視的層次
 * 感之間取得平衡：階數再少會讓中段數值的差異被壓縮到看不出來，階數再多則
 * 相鄰色階在螢幕上難以分辨。
 *
 * 色票來源：以品牌主色 `#003d92`（frontend-standards.md「設計 Token」）為
 * 色階最深的一端，線性內插至白色，取 t = 1/6, 2/6, …, 6/6（6/6 即
 * `#003d92` 本身）六個等距點，讓整條漸層階梯數學上「錨定」於品牌主色，
 * 而非另外挑選一組隨意的藍色。跳過 t = 0（純白）是刻意的：純白色的地區在
 * `#f4faff` 頁面背景下會與背景融為一色，看起來像是「地圖缺了一塊」，而非
 * 「0 筆職缺」，因此最淺一階仍保留可辨識的淡藍色。
 */
export const REGION_COLOR_STEPS: readonly string[] = [
  '#d5dfed',
  '#aabedb',
  '#809ec9',
  '#557eb6',
  '#2b5da4',
  '#003d92',
];

/**
 * 依 `maxValue`（當前資料集的最大值）將 `value` 對應到 `REGION_COLOR_STEPS`
 * 其中一階，回傳可直接用於 SVG `fill` 屬性的十六進位色碼字串（`RegionChoropleth`
 * 會將回傳值直接設為 `<path fill="...">`，因此刻意回傳實際色碼而非 Tailwind
 * class 名稱）。
 *
 * 邊界情況：
 * - `value <= 0`（含 0、負值、缺席資料正規化後的 0）：一律回傳最淺一階，
 *   不受 `maxValue` 影響（Requirement 2.2, 3.3, 4.4）。
 * - `maxValue <= 0`（空資料集，全部數值皆為 0）：一律回傳最淺一階，不做
 *   除以零的運算（不崩潰）。
 * - `value >= maxValue`：回傳最深一階（Requirement 2.1 的「依職缺數量深淺
 *   著色」隱含最大值對應最深色）。
 * - 中間值：以 `value / maxValue` 的比例線性切分為 `REGION_COLOR_STEPS.length`
 *   個等寬區間（類似 d3 的 threshold/quantize scale），確保數值越大階層
 *   越深、不同值之間的階層判定沒有重疊也沒有空隙。
 */
export function getRegionColor(value: number, maxValue: number): string {
  const lightestStep = REGION_COLOR_STEPS[0];
  const darkestStep = REGION_COLOR_STEPS[REGION_COLOR_STEPS.length - 1];

  if (!(maxValue > 0) || !(value > 0)) {
    return lightestStep;
  }

  const clampedValue = Math.min(value, maxValue);
  const ratio = clampedValue / maxValue;

  if (ratio >= 1) {
    return darkestStep;
  }

  const index = Math.min(
    REGION_COLOR_STEPS.length - 1,
    Math.floor(ratio * REGION_COLOR_STEPS.length),
  );

  return REGION_COLOR_STEPS[index];
}
