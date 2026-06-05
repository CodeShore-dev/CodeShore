import { SupabaseTable } from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { getSupabaseClient } from '@codeshore/supabase';

import { TableService } from '../shared-services/supabase/table.service';

export class JobService extends TableService<SupabaseTable.Job> {
  constructor(logger?: ServiceLogger) {
    super(getSupabaseClient(), 'job', logger, {
      upsert: { onConflict: 'id' },
    });
  }
}
