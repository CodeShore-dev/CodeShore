import { SupabaseView } from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { getSupabaseClient } from '@codeshore/supabase';

import { MaterializedViewService } from '../shared-services/supabase/materialized-view.service';

export class MvSalaryTypeMedianRatioService extends MaterializedViewService<SupabaseView.MvSalaryTypeMedianRatio> {
  constructor(logger?: ServiceLogger) {
    super(
      getSupabaseClient(),
      'mv_salary_type_median_ratio',
      logger,
    );
  }
}
