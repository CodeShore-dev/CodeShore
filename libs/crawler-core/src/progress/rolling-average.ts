/**
 * 單一數值滾動平均追蹤工具。
 *
 * 抽出自 `router/crawl-router.ts` 原本兩份內聯的滾動平均實作(清單頁耗時、
 * 詳情頁耗時各一份),兩者皆使用相同公式 `avg = (avg*(count-1)+elapsed)/count`,
 * 於呼叫 `recordSample` 前先遞增 count 再代入計算。此工具將其抽出為可重用的
 * 獨立元件,行為與原公式完全一致,僅消除重複(非重新設計)。
 */
export interface RollingAverageTracker {
  recordSample(elapsedMs: number): void;
  getAverage(): number;
  getSampleCount(): number;
}

export function createRollingAverageTracker(): RollingAverageTracker {
  let average = 0;
  let sampleCount = 0;

  return {
    recordSample(elapsedMs: number): void {
      sampleCount++;
      average = (average * (sampleCount - 1) + elapsedMs) / sampleCount;
    },
    getAverage(): number {
      return average;
    },
    getSampleCount(): number {
      return sampleCount;
    },
  };
}
