import { DEFAULT_MODEL_FALLBACK, DEFAULT_MODEL_SETTING_KEY, OpenRouterLlmClient } from '@codeshore/ai-client';

import { AiLlmSettingService } from './api/ai_llm_setting.service';
import { JobTechService } from './api/job_tech.service';
import { MvTechService } from './api/mv_tech';
import { resetKeywords } from './api/rpc';
import { generateJobKeywordsFromLines } from './job-keyword-line-extraction';
import { JobDescriptionBinService } from './api/job_description_bin.service';
import { parseKeywordsOut } from '@codeshore/shared-utils';
import { SupabaseTable } from '@codeshore/data-types';
import { JobService } from './api/job.service';
import { JobKeywordService } from '..';

/**
 * Model resolution mirrors `apps/backend/src/features/ai-suggestion/service.ts`'s
 * `generate()`: the backend-adjustable `ai_llm_setting.default_model` row
 * wins when present, otherwise fall back to the hardcoded
 * `DEFAULT_MODEL_FALLBACK` constant. `resetJobKeywords` has no per-call
 * model override parameter (unlike `generate()`'s `options?.model`), so
 * there is no first step in that chain here.
 */
export async function resetJobKeywordsV2(
  tech?: string,
  keyword?: string,
) {
  const model =
    (await new AiLlmSettingService().getValue(
      DEFAULT_MODEL_SETTING_KEY,
    )) ?? DEFAULT_MODEL_FALLBACK;
  const llmClient = new OpenRouterLlmClient(model);
  return generateJobKeywordsFromLines({
    llmClient,
    tech,
    keyword,
  });
}

export async function resetJobKeywordsV1(
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
  await resetJobKeywordsV1(tech, keyword);
  await resetKeywords();
  await new MvTechService().refresh();
  await new JobTechService().resetByJobKeywords();
}
