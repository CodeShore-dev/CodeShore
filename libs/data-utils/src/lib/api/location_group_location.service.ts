import { SupabaseTable } from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { getSupabaseClient } from '@codeshore/supabase';

import { TableService } from '../shared-services/supabase/table.service';

export class LocationGroupLocationService extends TableService<SupabaseTable.LocationGroup_.Location> {
  constructor(logger?: ServiceLogger) {
    super(getSupabaseClient(), 'location_group_location', logger);
  }

  /**
   * `location_group_location`'s only columns (`location_group`, `location`)
   * together form the composite primary key (`supabase/schema.sql`:
   * `location_group_location_pkey (location_group, location)`), so the
   * inherited `TableService.update`/`delete` (which target a single `id`
   * column) cannot address one specific mapping row. This filters on both
   * key columns instead, so a caller can re-point an existing mapping at a
   * different group and/or location string.
   */
  updateByGroupAndLocation(
    locationGroup: string,
    location: string,
    values: Partial<SupabaseTable.LocationGroup_.Location>,
  ) {
    return this.table
      .update(values as any)
      .eq('location_group', locationGroup)
      .eq('location', location);
  }

  /**
   * Deletes exactly one location-string-to-group mapping, identified by
   * both key columns.
   */
  deleteByGroupAndLocation(locationGroup: string, location: string) {
    return this.table
      .delete()
      .eq('location_group', locationGroup)
      .eq('location', location);
  }
}
