import { Injectable } from '@nestjs/common';

import {
  MvKeywordGroupCategoryService,
  MvKeywordGroupRankingService,
  MvKeywordGroupService,
  resetJobKeywords_Keywords_JobKeywordGroup,
} from '@codeshore/data-utils';
import {
  CacheService,
  Cacheable,
} from '@codeshore/service-cache';

import { QueryDto } from './../query.dto';

const CACHE_KEY_GROUP_VIEW = 'keyword:group:view';
const CACHE_KEY_GROUP_RANKING = 'keyword:group:ranking';
const CACHE_KEY_GROUP_CATEGORIES =
  'keyword:group:categories';

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
  ) {}

  async getMvKeywordGroup(query: QueryDto) {
    if (isFetchAllQuery(query)) {
      return this.cacheService.getOrSet(
        CACHE_KEY_GROUP_VIEW,
        () => this.mvKeywordGroupService.fetchAll(query),
      );
    }
    return this.mvKeywordGroupService.fetchAll(query);
  }

  async getMvKeywordGroupRanking(query: QueryDto) {
    const isTheRequestFromHomePage = query.from === 0 && query.to === 15
    if (isTheRequestFromHomePage) {
      return this.cacheService.getOrSet(
        query.where?.category?.eq
          ? `${CACHE_KEY_GROUP_RANKING}:${query.where.category.eq}`
          : CACHE_KEY_GROUP_RANKING,
        () => this.mvKeywordGroupRankingService.fetchAll(query),
      );
    }
    return this.mvKeywordGroupRankingService.fetchAll(query);
  }

  @Cacheable({ key: CACHE_KEY_GROUP_CATEGORIES })
  async getKeywordGroupCategories(query: QueryDto) {
    return this.mvKeywordGroupCategoryService.fetchAll(query);
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

