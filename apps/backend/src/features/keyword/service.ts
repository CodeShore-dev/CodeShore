import { Injectable } from '@nestjs/common';

import {
  addKeywordToKeywordGroup,
  createKeywordBin,
  createKeywordGroup_KeywordGroupJoinKeyword,
  deleteJobJoinKeywordGroup,
  deleteKeywordGroup,
  fetchKeywordGroupCategories,
  fetchMvKeywordGroup,
  resetJobKeywords_Keywords_JobJoinKeywordGroup,
  updateKeywordGroup_KeywordGroupJoinKeyword,
} from '@codeshore/data-utils';
import {
  CacheService,
  Cacheable,
  CacheEvict,
} from '@codeshore/service-cache';

import { QueryDto } from './../query.dto';
import { deleteKeywordGroupJoinKeyword } from 'libs/data-utils/src/lib/api/keyword_group_keyword';

const CACHE_KEY_GROUP_VIEW = 'keyword:group:view';
const CACHE_KEY_GROUP_CATEGORIES = 'keyword:group:categories';
const GROUP_CACHE_KEYS = [
  CACHE_KEY_GROUP_VIEW,
  CACHE_KEY_GROUP_CATEGORIES,
];

function isTheQuery(query: QueryDto): boolean {
  return query.from === 0 && query.to === -1;
}

@Injectable()
export class Service {
  constructor(private readonly cacheService: CacheService) {}

  async getKeywordGroupView(query: QueryDto) {
    if (isTheQuery(query)) {
      return this.cacheService.getOrSet(
        CACHE_KEY_GROUP_VIEW,
        () => fetchMvKeywordGroup(query),
      );
    }
    return fetchMvKeywordGroup(query);
  }

  @Cacheable({ key: CACHE_KEY_GROUP_CATEGORIES })
  async getKeywordGroupCategories(query: QueryDto) {
    return fetchKeywordGroupCategories(query);
  }

  @CacheEvict({ keys: GROUP_CACHE_KEYS })
  async createKeywordGroup(
    keywordGroup: string,
    keywords: string[] = [],
    category: string | null = null,
    parent: string | null = null,
  ) {
    return createKeywordGroup_KeywordGroupJoinKeyword(
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
    return updateKeywordGroup_KeywordGroupJoinKeyword(
      keywordGroup,
      keywords,
      category,
      parent,
    );
  }

  @CacheEvict({ keys: GROUP_CACHE_KEYS })
  async deleteKeywordGroup(keywordGroup: string) {
    await deleteKeywordGroupJoinKeyword(keywordGroup);
    await deleteJobJoinKeywordGroup(keywordGroup);
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

  resetJobKeywords_Keywords_JobJoinKeywordGroup(
    keywordGroup?: string,
    keyword?: string,
  ) {
    return resetJobKeywords_Keywords_JobJoinKeywordGroup(
      keywordGroup,
      keyword,
    );
  }
}
