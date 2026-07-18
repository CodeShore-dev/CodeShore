import { SupabaseTable } from '@codeshore/data-types';
import type { RequireDetailCrawl } from '@codeshore/crawler-core';

/**
 * 既有 Job 的最小中繼資訊,由引擎的 `resolveExisting()` 回傳、比對後
 * 補上 `RequireDetailCrawl.existingItem`(對應需求 6.1、6.2)。
 */
export type ExistingJob = Pick<
  SupabaseTable.Job,
  | 'id'
  | 'updated_at'
  | 'created_at'
  | 'title'
  | 'description'
  | 'location'
  | 'salary'
  | 'salary_manual'
  | 'closed'
>;

/**
 * `apps/crawler` 端需要進入詳情頁擷取的 Job 項目形狀,延伸
 * `@codeshore/crawler-core` 匯出的通用基礎型別 `RequireDetailCrawl`,
 * 取代直接依賴 Supabase Job 型別形狀的寫法(對應需求 6.1、6.2)。
 * 引擎既有的 `existingItem` 欄位在此以 `ExistingJob` 具體化。
 */
export type RequireToCrawlJob = RequireDetailCrawl<ExistingJob>;
