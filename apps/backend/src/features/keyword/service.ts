import { Injectable } from '@nestjs/common';

import {
  TechService,
  TechKeywordService,
  TechParentService,
  KeywordService,
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
    private readonly techKeywordService: TechKeywordService,
    private readonly techParentService: TechParentService,
    private readonly keywordService: KeywordService,
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

  /**
   * Requirement 7.5's manual-edit fallback: creates a new tech, optionally
   * mapping keywords to it and/or attaching it under a parent. Calls the
   * `libs/data-utils` write services (built in task 1.2) directly -- this is
   * independent of `AiSuggestionService.approve()` (task 2.2), per design.md's
   * "落地寫入的分工原則": both routes write through the same underlying
   * data-access layer without calling each other.
   *
   * `label` is not part of this form's input (only `id` is), so it defaults
   * to `id` itself; `tags` defaults to an empty array. Both are reasonable
   * defaults for a tech created via this minimal manual-edit form, and can be
   * refined later (e.g. via `updateTechIconSlugs`-style dedicated fields, or
   * simply overwritten by editing `label`/`tags` directly in the data store)
   * without affecting this route's contract.
   */
  async createTech(
    id: string,
    keywords: string[],
    category: string | null,
    parent: string | null,
  ) {
    // `SupabaseTable.Tech['category']` is typed as a non-null `string`
    // (mirroring `supabase/schema.sql`'s `tech.category` `NOT NULL`
    // constraint), but design.md's `CreateTechInput`/`UpdateTechInput` (the
    // "補齊 Keyword Controller/Service" block) and the already-committed
    // frontend contract (`apps/frontend/src/features/keyword/service.ts`)
    // both deliberately type `category` as `string | null`. The cast below
    // keeps this method's signature matching that committed contract; a
    // caller that actually passes `null` will get a clear Postgres
    // NOT-NULL-violation error surfaced through `error`/thrown here, the
    // same "let a real constraint violation surface naturally" approach used
    // by `deleteKeyword` below for the no-cascade FK case.
    const { error } = await this.techService.upsert([
      { id, category, label: id, tags: [] } as any,
    ]);
    if (error) throw new Error(error.message);

    if (keywords.length > 0) {
      const { error: keywordError } =
        await this.techKeywordService.upsert(
          keywords.map(keyword => ({ tech: id, keyword })),
        );
      if (keywordError) throw new Error(keywordError.message);
    }

    if (parent !== null) {
      const { error: parentError } =
        await this.techParentService.upsert([
          { parent, child: id },
        ]);
      if (parentError) throw new Error(parentError.message);
    }

    return { id };
  }

  /**
   * Requirement 7.5's manual-edit fallback: updates an existing tech.
   * `keywords`/`category`/`parent` are each independently optional -- only
   * the fields present in `payload` are changed (distinguished by
   * `undefined` checks, so an explicit `null` on `category`/`parent` is a
   * real value, not "omitted").
   */
  async updateTech(
    id: string,
    payload: {
      keywords?: string[];
      category?: string | null;
      parent?: string | null;
    },
  ) {
    if (payload.category !== undefined) {
      // Same `string | null` vs. schema `NOT NULL` mismatch as `createTech`
      // above -- see that method's comment.
      const { error } = await this.techService.update({
        id,
        category: payload.category,
      } as any);
      if (error) throw new Error(error.message);
    }

    if (payload.keywords !== undefined) {
      await this.replaceTechKeywords(id, payload.keywords);
    }

    if (payload.parent !== undefined) {
      await this.replaceTechParent(id, payload.parent);
    }

    return { id };
  }

  /**
   * Replaces `id`'s full `tech_keyword` mapping set with `nextKeywords`: a
   * full diff against the current rows, not a blind insert -- mappings no
   * longer present are deleted (via the composite-key
   * `deleteByTechAndKeyword`, task 2.2), and newly-added ones are upserted.
   * Unchanged keywords are touched by neither call.
   */
  private async replaceTechKeywords(
    id: string,
    nextKeywords: string[],
  ) {
    const { result: currentRows } =
      await this.techKeywordService.fetchAll({
        where: { tech: { eq: id } },
      });
    const currentKeywords = new Set(
      currentRows.map(row => row.keyword),
    );
    const nextKeywordSet = new Set(nextKeywords);

    const toDelete = [...currentKeywords].filter(
      keyword => !nextKeywordSet.has(keyword),
    );
    const toAdd = [...nextKeywordSet].filter(
      keyword => !currentKeywords.has(keyword),
    );

    for (const keyword of toDelete) {
      const { error } =
        await this.techKeywordService.deleteByTechAndKeyword(
          id,
          keyword,
        );
      if (error) throw new Error(error.message);
    }

    if (toAdd.length > 0) {
      const { error } = await this.techKeywordService.upsert(
        toAdd.map(keyword => ({ tech: id, keyword })),
      );
      if (error) throw new Error(error.message);
    }
  }

  /**
   * Replaces `id`'s `tech_parent` edge (where `id` is the child) with
   * `nextParent`. Removes any existing edge that doesn't match `nextParent`
   * (via the composite-key `deleteByParentAndChild`, task 2.2); when
   * `nextParent` is non-null, upserts the `(nextParent, id)` edge. An
   * explicit `null` means "remove the parent relationship" -- only the
   * delete happens, no new edge is added.
   */
  private async replaceTechParent(
    id: string,
    nextParent: string | null,
  ) {
    const { result: currentRows } =
      await this.techParentService.fetchAll({
        where: { child: { eq: id } },
      });

    for (const row of currentRows) {
      if (row.parent !== nextParent) {
        const { error } =
          await this.techParentService.deleteByParentAndChild(
            row.parent,
            id,
          );
        if (error) throw new Error(error.message);
      }
    }

    if (nextParent !== null) {
      const { error } = await this.techParentService.upsert([
        { parent: nextParent, child: id },
      ]);
      if (error) throw new Error(error.message);
    }
  }

  /**
   * Requirement 7.5's manual-edit fallback: deletes a tech. Per
   * `supabase/schema.sql`, `tech_keyword_join_tech_fkey` and both
   * `tech_parent_child_fkey`/`tech_parent_parent_fkey` are `ON DELETE
   * CASCADE`, so this single delete also removes the tech's `tech_keyword`
   * and `tech_parent` rows at the database level -- no manual cleanup of
   * those tables is needed here.
   */
  async deleteTech(id: string) {
    const { error } = await this.techService.delete(id);
    if (error) throw new Error(error.message);
    return { id };
  }

  /**
   * Requirement 7.5's manual-edit fallback: deletes a bare (unmapped)
   * keyword. This route is scoped by the frontend's own UI logic (the
   * `isKeyword` flag, `category === null`) to keywords that are not
   * currently referenced by any `tech_keyword` row. Unlike
   * `tech_keyword_join_tech_fkey`, `tech_keyword_mapping_keyword_fkey`
   * (keyword -> tech_keyword) has no `ON DELETE CASCADE` in
   * `supabase/schema.sql`; rather than add a defensive pre-check here, a
   * violation of that "bare keyword" assumption is left to surface naturally
   * as a Postgres FK-violation error (a clear failure), since only the
   * frontend's own UI decides when this route is reachable at all.
   */
  async deleteKeyword(id: string) {
    const { error } = await this.keywordService.delete(id);
    if (error) throw new Error(error.message);
    return { id };
  }
}
