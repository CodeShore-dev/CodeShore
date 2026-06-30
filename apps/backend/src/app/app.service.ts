import { Injectable } from '@nestjs/common';

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

import { QueryDto } from '../features/query.dto';

@Injectable()
export class AppService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly mvSalaryTypeMedianRatioService: MvSalaryTypeMedianRatioService,
    private readonly mvSalaryRangeMultiplierService: MvSalaryRangeMultiplierService,
    private readonly mvTechRankingService: MvTechRankingService,
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
