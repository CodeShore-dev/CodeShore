import { Injectable } from '@nestjs/common';

import {
  addKeywordToKeywordGroup,
  createKeywordBin,
  createKeywordGroup_KeywordGroupKeyword,
  deleteJobKeywordGroup,
  deleteKeywordGroup,
  deleteKeywordGroupKeyword,
  fetchMvKeywordGroup,
  fetchMvKeywordGroupCategories,
  fetchMvKeywordGroupRanking,
  resetJobKeywords_Keywords_JobKeywordGroup,
  updateKeywordGroup_KeywordGroupKeyword,
} from '@codeshore/data-utils';
import {
  CacheEvict,
  CacheService,
  Cacheable,
} from '@codeshore/service-cache';

import { QueryDto } from './../query.dto';

const CACHE_KEY_GROUP_VIEW = 'keyword:group:view';
const CACHE_KEY_GROUP_RANKING = 'keyword:group:ranking';
const CACHE_KEY_GROUP_CATEGORIES =
  'keyword:group:categories';
const GROUP_CACHE_KEYS = [
  CACHE_KEY_GROUP_VIEW,
  CACHE_KEY_GROUP_CATEGORIES,
];

function isFetchAllQuery(query: QueryDto): boolean {
  return query.from === 0 && query.to === -1;
}

@Injectable()
export class Service {
  constructor(
    private readonly cacheService: CacheService,
  ) {}

  async getKeywordGroupView(query: QueryDto) {
    if (isFetchAllQuery(query)) {
      return this.cacheService.getOrSet(
        CACHE_KEY_GROUP_VIEW,
        () => fetchMvKeywordGroup(query),
      );
    }
    return fetchMvKeywordGroup(query);
  }

  async getMvKeywordGroupRanking(query: QueryDto) {
    const isTheRequestFromHomePage = query.from === 0 && query.to === 15
    if (isTheRequestFromHomePage) {
      return this.cacheService.getOrSet(
        query.where?.category?.eq
          ? `${CACHE_KEY_GROUP_RANKING}:${query.where.category.eq}`
          : CACHE_KEY_GROUP_RANKING,
        () => fetchMvKeywordGroupRanking(query),
      );
    }
    return fetchMvKeywordGroupRanking(query);
  }

  @Cacheable({ key: CACHE_KEY_GROUP_CATEGORIES })
  async getKeywordGroupCategories(query: QueryDto) {
    return fetchMvKeywordGroupCategories(query);
  }

  @CacheEvict({ keys: GROUP_CACHE_KEYS })
  async createKeywordGroup(
    keywordGroup: string,
    keywords: string[] = [],
    category: string | null = null,
    parent: string | null = null,
  ) {
    return createKeywordGroup_KeywordGroupKeyword(
      keywordGroup,
      keywords,
      category,
      parent,
    );
  }

  @CacheEvict({ keys: GROUP_CACHE_KEYS })
  async updateKeywordGroup(
    keywordGroup: string,
    keywords: string[] = [],
    category: string | null = null,
    parent: string | null = null,
  ) {
    return updateKeywordGroup_KeywordGroupKeyword(
      keywordGroup,
      keywords,
      category,
      parent,
    );
  }

  @CacheEvict({ keys: GROUP_CACHE_KEYS })
  async deleteKeywordGroup(keywordGroup: string) {
    await deleteKeywordGroupKeyword(keywordGroup);
    await deleteJobKeywordGroup(keywordGroup);
    await deleteKeywordGroup(keywordGroup);
  }

  async deleteKeyword(keywordGroup: string) {
    return createKeywordBin(keywordGroup);
  }

  async addKeywordToGroup(
    keywordGroup: string,
    keyword: string,
    category: string | null = null,
    parent: string | null = null,
  ) {
    return addKeywordToKeywordGroup(
      keywordGroup,
      keyword,
      category,
      parent,
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

