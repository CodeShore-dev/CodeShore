import { Injectable } from '@nestjs/common';

import {
  KeywordGroupService,
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
    private readonly keywordGroupService: KeywordGroupService,
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

  async updateKeywordGroupIconSlugs(
    id: string,
    icon_slugs: string[],
  ) {
    const { error } = await this.keywordGroupService.update(
      {
        id,
        icon_slugs,
      },
    );
    if (error) throw new Error(error.message);
    // 讓 materialized view 與首頁全清單快取反映新順序
    await this.mvKeywordGroupService.refresh();
    await this.cacheService.invalidate(
      MvKeywordGroupService.name,
    );
    return { id, icon_slugs };
  }
}
