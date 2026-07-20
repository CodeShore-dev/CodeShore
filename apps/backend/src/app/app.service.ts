import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseFunction } from '@codeshore/data-types';
import { SCHEMA_SQL } from '@codeshore/data-types';
import {
  MvTechRankingService,
  MvSalaryTypeMedianRatioService,
  MvSalaryRangeMultiplierService,
  MvTechComboStatsService,
  getJobCount,
  getJobHostStatistics,
} from '@codeshore/data-utils';
import {
  CacheService,
  Cacheable,
} from '@codeshore/service-cache';

import type { WorkflowInfo } from '../features/ai-suggestion/workflow-info';
import { getWorkflowInfo } from '../features/ai-suggestion/workflow-info';
import type { KeywordCurationWorkflowInfo } from '../features/keyword-curation/workflow-info';
import { getKeywordCurationWorkflowInfo } from '../features/keyword-curation/workflow-info';
import { QueryDto } from '../features/query.dto';

/**
 * Public transparency payload for the methodology page's「AI 應用與工作流程」
 * section: the real, static `ai-suggestion` sub-workflow prompts/schemas and
 * the `keyword-curation` classifier prompt/schema plus its three decision
 * paths, unmodified from their respective source-of-truth functions (see
 * `getAiWorkflows()` below and requirements 2.3/3.3).
 */
export interface AiWorkflowsResponse {
  aiSuggestion: readonly WorkflowInfo[];
  keywordCuration: KeywordCurationWorkflowInfo;
}

@Injectable()
export class AppService {
  constructor(
    @Inject(CacheService) private readonly cacheService: CacheService,
    @Inject(MvSalaryTypeMedianRatioService)
    private readonly mvSalaryTypeMedianRatioService: MvSalaryTypeMedianRatioService,
    @Inject(MvSalaryRangeMultiplierService)
    private readonly mvSalaryRangeMultiplierService: MvSalaryRangeMultiplierService,
    @Inject(MvTechRankingService)
    private readonly mvTechRankingService: MvTechRankingService,
    @Inject(MvTechComboStatsService)
    private readonly mvTechComboStatsService: MvTechComboStatsService,
  ) {}

  @Cacheable({ key: getJobCount.name, ttl: 300 })
  async getJobCount(): Promise<SupabaseFunction.JobCount> {
    return (await getJobCount()).data;
  }

  @Cacheable({ key: getJobHostStatistics.name, ttl: 300 })
  async getJobHostStatistics(): Promise<
    SupabaseFunction.JobHostStatistic[]
  > {
    return getJobHostStatistics();
  }

  @Cacheable({ key: MvSalaryTypeMedianRatioService.name })
  async getMvSalaryTypeMedianRatio() {
    return this.mvSalaryTypeMedianRatioService.fetchAll();
  }

  @Cacheable({ key: MvSalaryRangeMultiplierService.name })
  async getMvSalaryRangeMultiplier() {
    return this.mvSalaryRangeMultiplierService.fetchAll();
  }

  /**
   * 回傳各資料庫物件（view / materialized view / function）的 SQL 定義，
   * 於建置時由 supabase/schema.sql 擷取（見 schema-sql.generated.ts），
   * 供方法論頁顯示每個分析數字背後的來源 SQL。
   */
  getMethodologySql(): Record<string, string> {
    return SCHEMA_SQL;
  }

  /**
   * Aggregates the two existing AI-curation features' real, static
   * prompt/schema transparency info -- `ai-suggestion`'s 5 sub-workflows and
   * `keyword-curation`'s classifier + 3 decision paths -- into a single
   * public payload for the methodology page's「AI 應用與工作流程」section.
   * A pure passthrough composing each source function's real output: never
   * reimplements or copies their content (requirements 2.1-2.3, 3.1, 3.3).
   * No caching per design.md's Out-of-Boundary note (both sources are
   * already synchronous, in-memory pure functions).
   */
  getAiWorkflows(): AiWorkflowsResponse {
    return {
      aiSuggestion: getWorkflowInfo(),
      keywordCuration: getKeywordCurationWorkflowInfo(),
    };
  }

  async getMvTechRanking(query: QueryDto) {
    const isTheRequestFromHomePage =
      query.from === 0 && query.to === 9;
    if (isTheRequestFromHomePage) {
      return this.cacheService.getOrSet(
        `${MvTechRankingService.name}:${JSON.stringify(query.where)}`,
        () =>
          this.mvTechRankingService.fetchAll(query),
      );
    }
    return this.mvTechRankingService.fetchAll(
      query,
    );
  }

  async getMvTechComboStatsService(query: QueryDto) {
    const isTheRequestFromHomePage =
      query.from === 0 && query.to === 4;
    if (isTheRequestFromHomePage) {
      return this.cacheService.getOrSet(
        `${MvTechComboStatsService.name}:${JSON.stringify(query.where)}`,
        () => this.mvTechComboStatsService.fetchAll(query),
      );
    }
    return this.mvTechComboStatsService.fetch(query);
  }
}
