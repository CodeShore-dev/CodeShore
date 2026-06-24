import {
  SupabaseView,
} from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { getSupabaseClient } from '@codeshore/supabase';

import { MaterializedViewService } from '../shared-services/supabase/materialized-view.service';

export class MvTechCategoryService extends MaterializedViewService<SupabaseView.MvTechCategory> {
  constructor(logger?: ServiceLogger) {
    super(
      getSupabaseClient(),
      'mv_tech_category',
      logger,
    );
  }
}
