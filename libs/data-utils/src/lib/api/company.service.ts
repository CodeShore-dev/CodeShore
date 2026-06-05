import { SupabaseTable } from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { getSupabaseClient } from '@codeshore/supabase';

import { TableService } from '../shared-services/supabase/table.service';

export class CompanyService extends TableService<SupabaseTable.Company> {
  constructor(logger?: ServiceLogger) {
    super(getSupabaseClient(), 'company', logger, {
      upsert: { onConflict: 'id', ignoreDuplicates: true },
    });
  }
}
