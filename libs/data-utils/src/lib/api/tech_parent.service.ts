import { SupabaseTable } from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { getSupabaseClient } from '@codeshore/supabase';

import { TableService } from '../shared-services/supabase/table.service';

export class TechParentService extends TableService<SupabaseTable.TechParent> {
  constructor(logger?: ServiceLogger) {
    super(getSupabaseClient(), 'tech_parent', logger);
  }

  /**
   * `tech_parent`'s only columns (`parent`, `child`) together form the
   * composite primary key (`supabase/schema.sql`: `tech_parent_pkey (parent,
   * child)`), so the inherited `TableService.update`/`delete` (which target
   * a single `id` column) cannot address one specific parent/child edge.
   * This filters on both key columns instead, so a caller can re-point an
   * existing edge at a different parent and/or child.
   */
  updateByParentAndChild(
    parent: string,
    child: string,
    values: Partial<SupabaseTable.TechParent>,
  ) {
    return this.table
      .update(values as any)
      .eq('parent', parent)
      .eq('child', child);
  }

  /**
   * Deletes exactly one parent/child edge, identified by both key columns.
   */
  deleteByParentAndChild(parent: string, child: string) {
    return this.table
      .delete()
      .eq('parent', parent)
      .eq('child', child);
  }
}
