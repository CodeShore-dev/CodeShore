import { SupabaseView } from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { getSupabaseClient } from '@codeshore/supabase';

import { MaterializedViewService } from '../shared-services/supabase/materialized-view.service';

export class MvSalaryWeightedRatioService extends MaterializedViewService<SupabaseView.MvSalaryWeightedRatio> {
  constructor(logger?: ServiceLogger) {
    super(
      getSupabaseClient(),
      'refresh_mv_salary_weighted_ratio',
      logger,
    );
  }
}
