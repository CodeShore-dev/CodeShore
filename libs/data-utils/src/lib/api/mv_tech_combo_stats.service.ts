import { SupabaseView } from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { getSupabaseClient } from '@codeshore/supabase';

import { MaterializedViewService } from '../shared-services/supabase/materialized-view.service';

export class MvTechComboStatsService extends MaterializedViewService<SupabaseView.MvTechComboStats> {
  constructor(logger?: ServiceLogger) {
    super(getSupabaseClient(), 'mv_tech_combo_stats', logger);
  }
}

