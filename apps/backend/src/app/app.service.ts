import { Injectable } from '@nestjs/common';

import type { SupabaseFunction } from '@codeshore/data-types';
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
