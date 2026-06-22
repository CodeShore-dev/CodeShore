import { Injectable } from '@nestjs/common';

import type { SupabaseFunction } from '@codeshore/data-types';
import { SCHEMA_SQL } from '@codeshore/data-types';
import {
  MvKeywordGroupRankingService,
  MvSalaryTypeMedianRatioService,
  MvSalaryWeightedRatioService,
  MvTechComboStatsService,
  getJobCount,
} from '@codeshore/data-utils';
import {
  CacheService,
  Cacheable,
} from '@codeshore/service-cache';

import { QueryDto } from '../features/query.dto';

@Injectable()
export class AppService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly mvSalaryTypeMedianRatioService: MvSalaryTypeMedianRatioService,
    private readonly mvSalaryWeightedRatioService: MvSalaryWeightedRatioService,
    private readonly mvKeywordGroupRankingService: MvKeywordGroupRankingService,
    private readonly mvTechComboStatsService: MvTechComboStatsService,
  ) {}

  @Cacheable({ key: getJobCount.name, ttl: 300 })
  async getJobCount(): Promise<SupabaseFunction.JobCount> {
    return (await getJobCount()).data;
  }

  @Cacheable({ key: MvSalaryTypeMedianRatioService.name })
  async getMvSalaryTypeMedianRatio() {
    return this.mvSalaryTypeMedianRatioService.fetchAll();
  }

  @Cacheable({ key: MvSalaryWeightedRatioService.name })
  async getMvSalaryWeightedRatio() {
    return this.mvSalaryWeightedRatioService.fetchAll();
  }

  /**
   * 回傳各資料庫物件（view / materialized view / function）的 SQL 定義，
   * 於建置時由 supabase/schema.sql 擷取（見 schema-sql.generated.ts），
   * 供方法論頁顯示每個分析數字背後的來源 SQL。
   */
  getMethodologySql(): Record<string, string> {
    return SCHEMA_SQL;
  }

  async getMvKeywordGroupRanking(query: QueryDto) {
    const isTheRequestFromHomePage =
      query.from === 0 && query.to === 9;
    if (isTheRequestFromHomePage) {
      return this.cacheService.getOrSet(
        `${MvKeywordGroupRankingService.name}:${JSON.stringify(query.where)}`,
        () =>
          this.mvKeywordGroupRankingService.fetchAll(query),
      );
    }
    return this.mvKeywordGroupRankingService.fetchAll(
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
