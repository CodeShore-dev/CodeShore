import dayjs from 'dayjs';

import type { SupabaseTable } from '@codeshore/data-types';
import { JobKeywordService, JobService } from '@codeshore/data-utils';
import { parseKeywordsOut, parseSalary } from '@codeshore/shared-utils';
import type { StalenessSyncConfig } from '@codeshore/sync-core';

import {
  extractJobDetailOnHTML as extractJobDetailOn104,
  isTheHost as is104Host,
  waitFordDetailPageSelector as waitForSelectorOn104,
} from './104/utils';
import {
  extractJobDetailOnHTML as extractJobDetailOnCake,
  isTheHost as isCakeHost,
  waitFordDetailPageSelector as waitForSelectorOnCake,
} from './cake/utils';

/**
 * Job 詳情頁擷取結果的共同形狀,104/Cake 兩邊的 `JobDetailOnHTML` 皆與此相容
 * (Cake 額外的 `company_type` 欄位在此不需要,`diffAndBuildUpdate` 只比對
 * `description`/`salary`/`location` 三個欄位,對應原 `reCrawlJobs` 的比對邏輯)。
 */
export type StalenessJobDetail = {
  description: string;
  salary: string;
  location: string;
};

/**
 * `apps/crawler` 端符合 `@codeshore/sync-core` 的 `StalenessSyncConfig<TEntity, TDetail>`
 * 合約的 Job 專屬實作,取代原 `apps/crawler/src/main.ts` 的 `reCrawlJobs`
 * (對應需求 6.1、6.2)。
 *
 * `allGroupKeywords`(原 `reCrawlJobs` 第一個參數)與 `where`(原 `reCrawlJobs`
 * 第三個參數,`resolvedWhere` 的組成邏輯)透過工廠函式參數傳入,因為
 * `diffAndBuildUpdate`/`fetchStaleEntities` 需要在各自的 closure 中使用它們,
 * 而 `StalenessSyncConfig` 本身的欄位簽章不允許額外參數。
 */
export function createJobStalenessSyncConfig(
  allGroupKeywords: string[],
  where?: Record<string, unknown>,
): StalenessSyncConfig<SupabaseTable.Job, StalenessJobDetail> {
  // `StalenessSyncConfig.onBatchReady` only receives the diffed `entity` list
  // (no `action` tag), but the original `reCrawlJobs` only recomputes/persists
  // `job_keyword` rows for jobs whose fields actually changed (main.ts
  // L225-231, inside the `descriptionChanged || salaryChanged ||
  // locationChanged` branch) — never for the `unchanged` or `close` cases.
  // Since `diffAndBuildUpdate` and `onBatchReady` share this factory's
  // closure, `diffAndBuildUpdate` records which entity ids came from the
  // "update" branch here, and `onBatchReady` consults it to decide which
  // entities need a recomputed `job_keyword` row, mirroring
  // `pending.jobKeywords.push` being called only in that one branch.
  const entityIdsNeedingKeywordRefresh = new Set<string>();

  return {
    /**
     * 對應原 `reCrawlJobs`(`main.ts` L100-109)的 stale 項目查詢:預設條件為
     * `updated_at` 早於「昨天午夜」,呼叫端可透過 `where` 覆寫查詢條件
     * (對應 `main.ts` 的 `re-crawl=<whereExpr>` CLI 參數)。
     */
    async fetchStaleEntities(): Promise<SupabaseTable.Job[]> {
      const todayDayjs = dayjs();
      const yesterday = todayDayjs.subtract(1, 'day').toDate();
      yesterday.setHours(0, 0, 0, 0);
      const resolvedWhere = where ?? {
        updated_at: { lt: yesterday.toISOString() },
      };
      const { result: jobs } = await new JobService().fetchAll({
        where: resolvedWhere,
        orders: [{ column: 'min_salary', ascending: false }],
      });
      return jobs;
    },

    /** 對應原 `reCrawlJobs` 的 `job.detail_link`(`main.ts` L278-280)。 */
    resolveDetailUrl(entity: SupabaseTable.Job): string {
      return entity.detail_link;
    },

    /**
     * 對應原 `reCrawlJobs` 的 host 判斷前置步驟(`main.ts` L155:
     * `new URL(request.url).hostname`)。實際的 `is104Host`/`isCakeHost`
     * 判斷分派給 `waitSelectorForHost`/`extractDetailForHost`(見下方),
     * 對應原本 `is104Host(detailLinkHost) ? ... : isCakeHost(...) ? ... : throw`
     * 的完整分支(`main.ts` L165-175)。未知 host 時原邏輯是
     * `throw new Error(...)`,此處延續到下面兩個函式對稱地拋出同樣的錯誤,
     * 該例外會被引擎的 `withErrorIsolation` 攔截(對應需求 3.8),與原本
     * try/catch 攔截行為一致。
     */
    resolveHost(url: string): string {
      return new URL(url).hostname;
    },

    /** 依 host 決定等待的選擇器,對應原 `waitForSelector` 指派邏輯。 */
    waitSelectorForHost(host: string): string {
      if (is104Host(host)) return waitForSelectorOn104;
      if (isCakeHost(host)) return waitForSelectorOnCake;
      throw new Error(`Unknown detail link host: ${host}`);
    },

    /** 依 host 決定擷取函式,對應原 `extractJobDetail` 指派邏輯。 */
    extractDetailForHost(host: string): () => StalenessJobDetail {
      if (is104Host(host)) return extractJobDetailOn104;
      if (isCakeHost(host)) return extractJobDetailOnCake;
      throw new Error(`Unknown detail link host: ${host}`);
    },

    /**
     * 完整取代原 `reCrawlJobs` 的
     * `if (detail.description.trim()) {...比對三欄位...} else {...標記 closed...}`
     * 分支(`main.ts` L187-251)。
     */
    diffAndBuildUpdate(
      entity: SupabaseTable.Job,
      detail: StalenessJobDetail | undefined,
    ):
      | { action: 'unchanged'; entity: SupabaseTable.Job }
      | { action: 'update'; entity: SupabaseTable.Job }
      | { action: 'close'; entity: SupabaseTable.Job } {
      if (!detail || !detail.description.trim()) {
        // 對應 main.ts L242-251:擷取不到有效內容,標記為 closed。
        return {
          action: 'close',
          entity: {
            ...entity,
            updated_at: new Date(),
            closed: true,
          },
        };
      }

      const descriptionChanged = detail.description !== entity.description;
      const salaryChanged =
        !entity.salary_manual && detail.salary !== entity.salary;
      const locationChanged = detail.location !== entity.location;

      if (descriptionChanged || salaryChanged || locationChanged) {
        // 對應 main.ts L211-224:至少一個欄位變動,套用更新,並標記這個
        // entity id 需要在 onBatchReady 重新計算/寫入 job_keyword
        // (對應 main.ts L225-231 的 pending.jobKeywords.push)。
        const salaryUpdate = salaryChanged
          ? {
              salary: detail.salary ?? '',
              ...parseSalary(detail.salary ?? ''),
            }
          : {};
        entityIdsNeedingKeywordRefresh.add(entity.id);
        return {
          action: 'update',
          entity: {
            ...entity,
            description: detail.description,
            location: detail.location,
            ...salaryUpdate,
            updated_at: new Date(),
            closed: false,
          },
        };
      }

      // 對應 main.ts L235-241:有內容但三個欄位皆無變動,僅刷新時間戳記。
      return {
        action: 'unchanged',
        entity: {
          ...entity,
          updated_at: new Date(),
          closed: false,
        },
      };
    },

    batchSize: 20,

    /**
     * 對應原 `flushPendingBatch`(`main.ts` L125-141)的持久化分派:
     * `JobService().upsert` 對應 `pending.jobs`,`JobKeywordService().upsert`
     * 對應 `pending.jobKeywords`——僅在 `diffAndBuildUpdate` 標記為需要刷新
     * 關鍵字的 entity(即原本 `update` 分支)才重新計算並寫入,`unchanged`/
     * `close` 分支的 entity 不觸碰 job_keyword,忠實對應原邏輯只在欄位變動時
     * 才 `pending.jobKeywords.push`。
     */
    async onBatchReady(entities: SupabaseTable.Job[]): Promise<void> {
      if (entities.length === 0) return;
      await new JobService().upsert([...entities]);
      const jobKeywords = entities
        .filter(job => entityIdsNeedingKeywordRefresh.has(job.id))
        .map(job => ({
          id: job.id,
          ...parseKeywordsOut(job.description, allGroupKeywords),
        }));
      for (const job of entities) {
        entityIdsNeedingKeywordRefresh.delete(job.id);
      }
      if (jobKeywords.length > 0) {
        await new JobKeywordService().upsert(jobKeywords);
      }
    },
  };
}
