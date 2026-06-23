import {
  SupabaseTable,
  SupabaseView,
} from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { getSupabaseClient } from '@codeshore/supabase';

import { TableService } from '../shared-services/supabase/table.service';
import { distinct } from '../shared-services/supabase/utils';
import { JobKeywordService } from './job_keyword.service';
import { MvTechService } from './mv_tech';

export class JobTechService extends TableService<SupabaseTable.Job_.Tech> {
  constructor(logger?: ServiceLogger) {
    super(
      getSupabaseClient(),
      'job_tech',
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

    const techs = (
      await new MvTechService().fetchAll({
        where: { category: { 'not.is': null } },
      })
    ).result;

    const format = _makeFormatter(techs);

    return this.reset(
      distinct(
        _jobKeywords
          .flatMap(format)
          .filter(x => x !== null),
        (a, b) =>
          a.job_id === b.job_id &&
          a.tech === b.tech,
      ),
    );
  }
}

function _makeFormatter(
  techs: SupabaseView.MvTech[],
) {
  return (jobKeyword: SupabaseTable.Job_.Keyword) =>
    jobKeyword.keywords.map(keyword => {
      const tech = techs.find(x =>
        x.keywords.includes(keyword),
      );
      return tech
        ? {
            job_id: jobKeyword.id,
            tech: tech?.tech,
            keywords: tech?.keywords.join(','),
          }
        : null;
    });
}
