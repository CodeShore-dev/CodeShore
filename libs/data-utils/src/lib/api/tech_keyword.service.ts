import { SupabaseTable } from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { getSupabaseClient } from '@codeshore/supabase';

import { TableService } from '../shared-services/supabase/table.service';

export class TechKeywordService extends TableService<SupabaseTable.Tech_.Keyword> {
  constructor(logger?: ServiceLogger) {
    super(
      getSupabaseClient(),
      'tech_keyword',
      logger,
    );
  }

  /**
   * `tech_keyword`'s only columns (`tech`, `keyword`) together form the
   * composite primary key (`supabase/schema.sql`: no `id` column on this
   * table), so the inherited `TableService.update`/`delete` (which target a
   * single `id` column via `.eq('id', ...)`) cannot address one specific
   * tech/keyword mapping and would fail against real Postgres. This mirrors
   * `TechParentService.updateByParentAndChild`, filtering on both key
   * columns instead, so a caller can re-point an existing mapping at a
   * different tech and/or keyword.
   */
  updateByTechAndKeyword(
    tech: string,
    keyword: string,
    values: Partial<SupabaseTable.Tech_.Keyword>,
  ) {
    return this.table
      .update(values as any)
      .eq('tech', tech)
      .eq('keyword', keyword);
  }

  /**
   * Deletes exactly one tech/keyword mapping, identified by both key
   * columns. Mirrors `TechParentService.deleteByParentAndChild`.
   */
  deleteByTechAndKeyword(tech: string, keyword: string) {
    return this.table
      .delete()
      .eq('tech', tech)
      .eq('keyword', keyword);
  }
}
