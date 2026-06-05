import { SupabaseTable } from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { getSupabaseClient } from '@codeshore/supabase';

import { TableService } from '../shared-services/supabase/table.service';

export class JobPreferenceService extends TableService<
  SupabaseTable.JobPreference,
  Omit<SupabaseTable.JobPreference, 'updated_at'>
> {
  constructor(logger?: ServiceLogger) {
    super(getSupabaseClient(), 'job_preference', logger);
  }
  deleteByUserAndPreference(
    userId: string,
    preference: string,
  ) {
    return this.table
      .delete()
      .eq('user_id', userId)
      .eq('preference', preference);
  }
}
