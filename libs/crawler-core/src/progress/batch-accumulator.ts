/**
 * 批次累積工具:累積項目,長度達 `resolveBatchSize()` 回傳值時自動觸發
 * `onFlush` 並清空;`flushRemaining` 供收尾呼叫,累積數量為 0 時不觸發 `onFlush`。
 *
 * 抽出自 `router/crawl-router.ts` 原本內聯的 `pendingItems`/`batchSize`/
 * `flushPending` 批次累積邏輯(門檻檢查採 `>=`,flush 後以 `splice` 清空並
 * 保留原陣列參照),行為與原邏輯完全一致,僅消除重複(非重新設計)。
 * `resolveBatchSize()` 每次 push 時重新呼叫,而非快取單一初始值,以符合原本
 * `batchSize` closure 變數可於清單頁走訪時被重新賦值的行為。
 */
export interface BatchAccumulator<T> {
  push(item: T): Promise<void>;
  flushRemaining(): Promise<void>;
}

export function createBatchAccumulator<T>(options: {
  resolveBatchSize: () => number;
  onFlush: (items: T[]) => Promise<void>;
}): BatchAccumulator<T> {
  const pendingItems: T[] = [];

  const flush = async (): Promise<void> => {
    if (pendingItems.length === 0) return;
    const batch = pendingItems.splice(0, pendingItems.length);
    await options.onFlush(batch);
  };

  return {
    async push(item: T): Promise<void> {
      pendingItems.push(item);
      if (pendingItems.length >= options.resolveBatchSize()) {
        await flush();
      }
    },
    async flushRemaining(): Promise<void> {
      await flush();
    },
  };
}
