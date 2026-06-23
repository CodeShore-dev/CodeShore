import {
  SupabaseView,
} from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { getSupabaseClient } from '@codeshore/supabase';

import { MaterializedViewService } from '../shared-services/supabase/materialized-view.service';

export class MvTechTagsService extends MaterializedViewService<SupabaseView.MvTechTags> {
  constructor(logger?: ServiceLogger) {
    super(
      getSupabaseClient(),
      'mv_tech_tags',
      logger,
    );
  }
}
