import { Injectable } from '@nestjs/common';

import {
  MvKeywordGroupCategoryService,
  MvKeywordGroupService,
  resetJobKeywords_Keywords_JobKeywordGroup,
} from '@codeshore/data-utils';
import {
  CacheService,
  Cacheable,
} from '@codeshore/service-cache';

import { QueryDto } from './../query.dto';

@Injectable()
export class Service {
  constructor(
    private readonly cacheService: CacheService,
    private readonly mvKeywordGroupService: MvKeywordGroupService,
    private readonly mvKeywordGroupCategoryService: MvKeywordGroupCategoryService,
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

