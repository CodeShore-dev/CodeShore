import { SupabaseTable } from '@codeshore/data-types';
import { parseKeywordsOut } from '@codeshore/shared-utils';

import { JobService } from './api/job.service';
import { JobDescriptionBinService } from './api/job_description_bin.service';
import { JobKeywordService } from './api/job_keyword.service';
import { JobKeywordGroupService } from './api/job_keyword_group.service';
import { MvKeywordGroupService } from './api/mv_keyword_group';
import { resetKeywords } from './api/rpc';

export async function resetJobKeywords(
  keywordGroup?: string,
  keyword?: string,
) {
  const { result: jobDescriptionBins } =
    await new JobDescriptionBinService().fetchAll();
  const { result: keywordGroups } =
    await new MvKeywordGroupService().fetchAll({
      where: { category: { 'not.is': null } },
    });
  const { result: jobs } =
    await new JobService().fetchAll();
  const jobKeywords: SupabaseTable.Job_.Keyword[] =
    jobs.map(x => ({
      id: x.id,
      ...parseKeywordsOut(
        jobDescriptionBins.reduce((prev, curr) => {
          return prev.replace(curr.content, '');
        }, x.description),
        keywordGroups
          .flatMap(m => m.keywords)
          .concat(
            [keywordGroup, keyword].filter(
              Boolean,
            ) as string[],
          ),
      ),
    }));
  return new JobKeywordService().upsert(jobKeywords);
}

export async function resetJobKeywords_Keywords_JobKeywordGroup(
  keywordGroup?: string,
  keyword?: string,
) {
  await resetJobKeywords(keywordGroup, keyword);
  await resetKeywords();
  await new MvKeywordGroupService().refresh();
  await new JobKeywordGroupService().resetByJobKeywords();
}
