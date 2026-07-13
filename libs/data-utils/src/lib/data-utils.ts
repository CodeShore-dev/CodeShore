import { DEFAULT_MODEL_FALLBACK, DEFAULT_MODEL_SETTING_KEY, OpenRouterLlmClient } from '@codeshore/ai-client';

import { AiLlmSettingService } from './api/ai_llm_setting.service';
import { JobTechService } from './api/job_tech.service';
import { MvTechService } from './api/mv_tech';
import { resetKeywords } from './api/rpc';
import { generateJobKeywordsFromLines } from './job-keyword-line-extraction';

/**
 * Model resolution mirrors `apps/backend/src/features/ai-suggestion/service.ts`'s
 * `generate()`: the backend-adjustable `ai_llm_setting.default_model` row
 * wins when present, otherwise fall back to the hardcoded
 * `DEFAULT_MODEL_FALLBACK` constant. `resetJobKeywords` has no per-call
 * model override parameter (unlike `generate()`'s `options?.model`), so
 * there is no first step in that chain here.
 */
export async function resetJobKeywords(
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

export async function resetJobKeywords_Keywords_JobTech(
  tech?: string,
  keyword?: string,
) {
  await resetJobKeywords(tech, keyword);
  await resetKeywords();
  await new MvTechService().refresh();
  await new JobTechService().resetByJobKeywords();
}
