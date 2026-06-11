import { Injectable } from '@nestjs/common';

import {
  MvKeywordGroupCategoryService,
  MvKeywordGroupRankingService,
  MvKeywordGroupService,
  MvTechComboStatsService,
  resetJobKeywords_Keywords_JobKeywordGroup,
} from '@codeshore/data-utils';
import {
  CacheService,
  Cacheable,
} from '@codeshore/service-cache';

import { QueryDto } from './../query.dto';

function isFetchAllQuery(query: QueryDto): boolean {
  return query.from === 0 && query.to === -1;
}

@Injectable()
export class Service {
  constructor(
    private readonly cacheService: CacheService,
    private readonly mvKeywordGroupService: MvKeywordGroupService,
    private readonly mvKeywordGroupCategoryService: MvKeywordGroupCategoryService,
    private readonly mvKeywordGroupRankingService: MvKeywordGroupRankingService,
    private readonly mvTechComboStatsService: MvTechComboStatsService,
  ) {}

  async getMvKeywordGroup(query: QueryDto) {
    const isTheRequestFromHomePage = (query: QueryDto) =>
      query.from === 0 && query.to === -1;
    if (isTheRequestFromHomePage(query)) {
      return this.cacheService.getOrSet(
        MvKeywordGroupService.name,
        () => this.mvKeywordGroupService.fetchAll(query),
      );
    }
    return this.mvKeywordGroupService.fetchAll(query);
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

  @Cacheable({ key: MvKeywordGroupCategoryService.name })
  async getKeywordGroupCategories(query: QueryDto) {
    return this.mvKeywordGroupCategoryService.fetchAll(
      query,
    );
  }

  resetJobKeywords_Keywords_JobKeywordGroup(
    keywordGroup?: string,
    keyword?: string,
  ) {
    return resetJobKeywords_Keywords_JobKeywordGroup(
      keywordGroup,
      keyword,
    );
  }
}

