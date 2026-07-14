export interface KeywordGroup {
  /** mv_tech.category 的既有分類值（如 'backend_runtime'、'frontend_framework'、'language' 等）。
   *  若 AI 或 fallback 無法確定分類則填入 'other'。 */
  category: string;
  /** 此群組的關鍵字集合；群組內任一即可（OR 語意）。 */
  keywords: string[];
}
