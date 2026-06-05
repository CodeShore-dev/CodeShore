import {
  SupabaseView,
} from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { getSupabaseClient } from '@codeshore/supabase';

import { MaterializedViewService } from '../shared-services/supabase/materialized-view.service';

export class MvKeywordGroupRankingService extends MaterializedViewService<SupabaseView.MvKeywordGroupRanking> {
  constructor(logger?: ServiceLogger) {
    super(
      getSupabaseClient(),
      'mv_keyword_group_ranking',
      logger,
    );
  }
}
