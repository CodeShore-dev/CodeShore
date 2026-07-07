import { SupabaseTable } from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { getSupabaseClient } from '@codeshore/supabase';

import { TableService } from '../shared-services/supabase/table.service';

export class LocationGroupService extends TableService<SupabaseTable.LocationGroup> {
  constructor(logger?: ServiceLogger) {
    super(getSupabaseClient(), 'location_group', logger);
  }

  /**
   * `location_group` has a single column (`id`), which is also its primary
   * key (`supabase/schema.sql`: `location_group_pkey (id)`), so the only
   * meaningful "update" of an existing row is renaming that id. The
   * `location_group_location_location_group_fkey` foreign key cascades the
   * rename (`ON UPDATE CASCADE`) to any mapped `location_group_location`
   * rows.
   */
  renameId(oldId: string, newId: string) {
    return this.table
      .update({ id: newId } as any)
      .eq('id', oldId);
  }
}
