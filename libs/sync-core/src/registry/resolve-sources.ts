import type {
  SourceLocation,
  SourceProcessingMode,
  SourceRegistry,
} from './types';

/**
 * 依 fresh/resume 模式決定本次要處理的來源分頁清單。
 *
 * - resume 模式:若有登記為 pending 的分頁,直接回傳這些分頁;若沒有,回傳空
 *   陣列,代表沒有可續傳的工作,不查詢基底來源。
 * - fresh 模式:先清空所有已追蹤的分頁狀態,再取得所有基底來源,並將每個來源
 *   映射為第一頁的來源位置。每個來源的第 1 頁會先被登記為 pending(見
 *   `SourceRegistry.seedPendingPage1`),確保即使爬蟲在第 1 頁完成前就中斷,
 *   之後的 resume 模式仍能透過 `fetchPendingSources` 撿回這個來源續爬。
 */
export async function resolveSourcesToProcess(
  registry: SourceRegistry,
  mode: SourceProcessingMode,
): Promise<SourceLocation[]> {
  if (mode === 'resume') {
    return registry.fetchPendingSources();
  }

  await registry.clearAll();
  const baseSources = await registry.fetchBaseSources();
  await Promise.all(
    baseSources.map(url => registry.seedPendingPage1(url)),
  );
  return baseSources.map(url => ({ url, pageIndex: 1 }));
}
