import { Injectable } from '@nestjs/common';

import {
  TechService,
  MvTechCategoryService,
  MvTechService,
  resetJobKeywords_Keywords_JobTech,
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
    private readonly techService: TechService,
    private readonly mvTechService: MvTechService,
    private readonly mvTechCategoryService: MvTechCategoryService,
  ) {}

  async getMvTech(query: QueryDto) {
    const isTheRequestFromHomePage = (query: QueryDto) =>
      query.from === 0 && query.to === -1;
    if (isTheRequestFromHomePage(query)) {
      return this.cacheService.getOrSet(
        MvTechService.name,
        () => this.mvTechService.fetchAll(query),
      );
    }
    return this.mvTechService.fetchAll(query);
  }

  @Cacheable({ key: MvTechCategoryService.name })
  async getTechCategories(query: QueryDto) {
    return this.mvTechCategoryService.fetchAll(
      query,
    );
  }

  resetJobKeywords_Keywords_JobTech(
    tech?: string,
    keyword?: string,
  ) {
    return resetJobKeywords_Keywords_JobTech(
      tech,
      keyword,
    );
  }

  async updateTechIconSlugs(
    id: string,
    icon_slugs: string[],
  ) {
    const { error } = await this.techService.update(
      {
        id,
        icon_slugs,
      },
    );
    if (error) throw new Error(error.message);
    // 讓 materialized view 與首頁全清單快取反映新順序
    await this.mvTechService.refresh();
    await this.cacheService.invalidate(
      MvTechService.name,
    );
    return { id, icon_slugs };
  }
}
