import { SupabaseTable } from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { getSupabaseClient } from '@codeshore/supabase';

import { TableService } from '../shared-services/supabase/table.service';

export class KeywordBinService extends TableService<SupabaseTable.KeywordBin> {
  constructor(logger?: ServiceLogger) {
    super(getSupabaseClient(), 'keyword_bin', logger);
  }
}
