import { SupabaseTable } from '@codeshore/data-types';
import { parseKeywordsOut } from '@codeshore/shared-utils';

import { JobService } from './api/job.service';
import { JobDescriptionBinService } from './api/job_description_bin.service';
import { JobKeywordService } from './api/job_keyword.service';
import { JobTechService } from './api/job_tech.service';
import { MvTechService } from './api/mv_tech';
import { resetKeywords } from './api/rpc';

export async function resetJobKeywords(
  tech?: string,
  keyword?: string,
) {
  const { result: jobDescriptionBins } =
    await new JobDescriptionBinService().fetchAll();
  const { result: techs } =
    await new MvTechService().fetchAll({
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
        techs
          .flatMap(m => m.keywords)
          .concat(
            [tech, keyword].filter(
              Boolean,
            ) as string[],
          ),
      ),
    }));
  return new JobKeywordService().upsert(jobKeywords);
}

export async function resetJobKeywords_Keywords_JobTech(
  tech?: string,
  keyword?: string,
) {
  await resetJobKeywords(tech, keyword);
  await resetKeywords();
  await new MvTechService().refresh();
  await new JobTechService().resetByJobKeywords();
}
