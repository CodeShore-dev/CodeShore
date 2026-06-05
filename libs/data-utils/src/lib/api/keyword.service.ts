import { SupabaseTable } from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { getSupabaseClient } from '@codeshore/supabase';

import { TableService } from '../shared-services/supabase/table.service';

export class KeywordService extends TableService<SupabaseTable.Keyword> {
  constructor(logger?: ServiceLogger) {
    super(getSupabaseClient(), 'keyword', logger);
  }
}
