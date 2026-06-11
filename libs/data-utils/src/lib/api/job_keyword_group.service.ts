import {
  SupabaseTable,
  SupabaseView,
} from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { getSupabaseClient } from '@codeshore/supabase';

import { TableService } from '../shared-services/supabase/table.service';
import { distinct } from '../shared-services/supabase/utils';
import { JobKeywordService } from './job_keyword.service';
import { MvKeywordGroupService } from './mv_keyword_group';

export class JobKeywordGroupService extends TableService<SupabaseTable.Job_.KeywordGroup> {
  constructor(logger?: ServiceLogger) {
    super(
      getSupabaseClient(),
      'job_keyword_group',
      logger,
      { delete_update: { idField: 'job_id' } },
    );
  }
  async resetByJobKeywords(
    jobKeywords?: SupabaseTable.Job_.Keyword[],
  ) {
    const _jobKeywords =
      jobKeywords ??
      (await new JobKeywordService(this.logger).fetchAll())
        .result;

    const keywordGroups = (
      await new MvKeywordGroupService().fetchAll({
        where: { category: { 'not.is': null } },
      })
    ).result;

    const format = _makeFormatter(keywordGroups);

    return this.reset(
      distinct(
        _jobKeywords
          .flatMap(format)
          .filter(x => x !== null),
        (a, b) =>
          a.job_id === b.job_id &&
          a.keyword_group === b.keyword_group,
      ),
    );
  }
}

function _makeFormatter(
  keywordGroups: SupabaseView.MvKeywordGroup[],
) {
  return (jobKeyword: SupabaseTable.Job_.Keyword) =>
    jobKeyword.keywords.map(keyword => {
      const keywordGroup = keywordGroups.find(x =>
        x.keywords.includes(keyword),
      );
      return keywordGroup
        ? {
            job_id: jobKeyword.id,
            keyword_group: keywordGroup?.keyword_group,
            keywords: keywordGroup?.keywords.join(','),
          }
        : null;
    });
}
