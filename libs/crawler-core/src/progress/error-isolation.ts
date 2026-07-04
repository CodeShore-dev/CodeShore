/**
 * 包裝 `fn()`:攔截其拋出的同步例外或非同步 rejection,透過 `logger.error`
 * 記錄(訊息包含呼叫端提供的 `context` 字串以利識別來源),並回傳 `undefined`
 * 而非重新拋出——確保呼叫端能以 `await withErrorIsolation(...)` 在迴圈中使用,
 * 單一項目失敗不會中斷後續項目的處理。
 *
 * 對應 `router/crawl-router.ts` 現有清單頁與詳情頁 handler 各自的
 * `try { ... } catch (error) { log.error(...); }` 錯誤隔離模式,泛化為
 * 獨立、可重用的底層工具。
 */
export async function withErrorIsolation<T>(
  logger: { error: (msg: string) => void },
  context: string,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    logger.error(`[${context}] ${error}`);
    return undefined;
  }
}
