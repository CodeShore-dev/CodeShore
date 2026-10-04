/**
 * `data-utils.ts` keeps two job-keyword reset pipelines side by side:
 *
 * - `resetJobKeywordsV2` delegates the whole extraction to the LLM batch
 *   orchestrator `generateJobKeywordsFromLines()` (task 2.2/2.3,
 *   `./job-keyword-line-extraction.ts`), after resolving the model through
 *   `AiLlmSettingService`.
 * - `resetJobKeywordsV1` is the no-LLM pipeline: fetch every job, strip the
 *   `job_description_bin` boilerplate out of each description, run
 *   `parseKeywordsOut()` against the `mv_tech` vocabulary, and upsert the
 *   result.
 *
 * `resetJobKeywords_Keywords_JobTech()` -- the route behind admin "reset
 * keywords" and `mv-refresh-all` -- calls **V1**, then `resetKeywords()` ->
 * `MvTechService().refresh()` -> `JobTechService().resetByJobKeywords()` in
 * that exact order (design.md 5.4, traceability row 5.4). Both pipelines and
 * that ordering are covered below.
 *
 * Follows `apps/backend/src/features/ai-suggestion/service.spec.ts`'s
 * `vi.hoisted` + module-mock convention (required here, unlike
 * `job-keyword-line-extraction.spec.ts`'s plain top-level consts, because
 * `vi.mock` factories are hoisted above all other top-level statements --
 * referencing a non-hoisted `const` from inside one throws a temporal-dead-
 * zone `ReferenceError`): fake every collaborator at the module boundary via
 * `vi.mock(...)`, no real Supabase client, no real HTTP/LLM call.
 */

const {
  generateJobKeywordsFromLines,
  getValue,
  openRouterLlmClientCtor,
  resetKeywords,
  mvTechRefresh,
  mvTechFetchAll,
  resetByJobKeywords,
  jobDescriptionBinFetchAll,
  jobFetchAll,
  jobKeywordUpsert,
  parseKeywordsOut,
} = vi.hoisted(() => ({
  generateJobKeywordsFromLines: vi.fn(),
  getValue: vi.fn(),
  openRouterLlmClientCtor: vi.fn(),
  resetKeywords: vi.fn(),
  mvTechRefresh: vi.fn(),
  mvTechFetchAll: vi.fn(),
  resetByJobKeywords: vi.fn(),
  jobDescriptionBinFetchAll: vi.fn(),
  jobFetchAll: vi.fn(),
  jobKeywordUpsert: vi.fn(),
  parseKeywordsOut: vi.fn(),
}));

vi.mock('./job-keyword-line-extraction', () => ({
  generateJobKeywordsFromLines,
}));

vi.mock('./api/ai_llm_setting.service', () => ({
  AiLlmSettingService: vi.fn().mockImplementation(() => ({
    getValue,
  })),
}));

// Only `OpenRouterLlmClient` is stubbed (mirrors
// `apps/backend/src/features/ai-suggestion/service.spec.ts`'s convention);
// `DEFAULT_MODEL_SETTING_KEY`/`DEFAULT_MODEL_FALLBACK` pass through from the
// real module so `resetJobKeywordsV2`'s own `getValue(DEFAULT_MODEL_SETTING_KEY)`
// call and fallback constant match what the assertions below expect.
vi.mock('@codeshore/ai-client', async importOriginal => {
  const actual = await importOriginal<typeof import('@codeshore/ai-client')>();
  return {
    ...actual,
    OpenRouterLlmClient: openRouterLlmClientCtor,
  };
});

vi.mock('./api/rpc', () => ({
  resetKeywords,
}));

// V1 reads the tech vocabulary through `fetchAll`; the orchestrator calls
// `refresh` on the same service, so one mock carries both.
vi.mock('./api/mv_tech', () => ({
  MvTechService: vi.fn().mockImplementation(() => ({
    refresh: mvTechRefresh,
    fetchAll: mvTechFetchAll,
  })),
}));

vi.mock('./api/job_tech.service', () => ({
  JobTechService: vi.fn().mockImplementation(() => ({
    resetByJobKeywords,
  })),
}));

vi.mock('./api/job_description_bin.service', () => ({
  JobDescriptionBinService: vi.fn().mockImplementation(() => ({
    fetchAll: jobDescriptionBinFetchAll,
  })),
}));

vi.mock('./api/job.service', () => ({
  JobService: vi.fn().mockImplementation(() => ({
    fetchAll: jobFetchAll,
  })),
}));

vi.mock('./api/job_keyword.service', () => ({
  JobKeywordService: vi.fn().mockImplementation(() => ({
    upsert: jobKeywordUpsert,
  })),
}));

// `parseKeywordsOut` is pure and has its own tests in `@codeshore/shared-utils`;
// stubbing it here keeps these tests on V1's own contract -- which text and
// which vocabulary V1 hands it, and what V1 does with the return value.
vi.mock('@codeshore/shared-utils', async importOriginal => {
  const actual = await importOriginal<typeof import('@codeshore/shared-utils')>();
  return {
    ...actual,
    parseKeywordsOut,
  };
});

import { DEFAULT_MODEL_FALLBACK, DEFAULT_MODEL_SETTING_KEY } from '@codeshore/ai-client';

import {
  resetJobKeywordsV1,
  resetJobKeywordsV2,
  resetJobKeywords_Keywords_JobTech,
} from './data-utils';

beforeEach(() => {
  vi.clearAllMocks();
  generateJobKeywordsFromLines.mockResolvedValue(undefined);
  resetKeywords.mockResolvedValue(undefined);
  mvTechRefresh.mockResolvedValue(undefined);
  resetByJobKeywords.mockResolvedValue(undefined);
  // V1's default happy path: no boilerplate bins, no techs, no jobs. Each V1
  // test overrides whichever of these it actually exercises.
  jobDescriptionBinFetchAll.mockResolvedValue({ result: [] });
  mvTechFetchAll.mockResolvedValue({ result: [] });
  jobFetchAll.mockResolvedValue({ result: [] });
  jobKeywordUpsert.mockResolvedValue(undefined);
  parseKeywordsOut.mockReturnValue({
    keywords: [],
    description_ch_en_ratio: 0,
  });
});

describe('resetJobKeywordsV2 (LLM pipeline)', () => {
  it('resolves the model from AiLlmSettingService, builds an OpenRouterLlmClient with it, and delegates to generateJobKeywordsFromLines with the forwarded tech/keyword (5.2)', async () => {
    getValue.mockResolvedValue('some/configured-model');

    await resetJobKeywordsV2('react', 'frontend');

    expect(getValue).toHaveBeenCalledWith(DEFAULT_MODEL_SETTING_KEY);
    expect(openRouterLlmClientCtor).toHaveBeenCalledWith('some/configured-model');
    expect(generateJobKeywordsFromLines).toHaveBeenCalledTimes(1);
    const options = generateJobKeywordsFromLines.mock.calls[0][0];
    expect(options.llmClient).toBeInstanceOf(openRouterLlmClientCtor);
    expect(options.tech).toBe('react');
    expect(options.keyword).toBe('frontend');
  });

  it('falls back to DEFAULT_MODEL_FALLBACK when AiLlmSettingService has no stored value', async () => {
    getValue.mockResolvedValue(null);

    await resetJobKeywordsV2();

    expect(openRouterLlmClientCtor).toHaveBeenCalledWith(DEFAULT_MODEL_FALLBACK);
    const options = generateJobKeywordsFromLines.mock.calls[0][0];
    expect(options.tech).toBeUndefined();
    expect(options.keyword).toBeUndefined();
  });

  it('performs no inline per-job extraction/upsert -- generateJobKeywordsFromLines is the only thing it delegates to', async () => {
    getValue.mockResolvedValue('some/model');

    await resetJobKeywordsV2();

    expect(generateJobKeywordsFromLines).toHaveBeenCalledTimes(1);
    expect(jobDescriptionBinFetchAll).not.toHaveBeenCalled();
    expect(jobFetchAll).not.toHaveBeenCalled();
    expect(parseKeywordsOut).not.toHaveBeenCalled();
    expect(jobKeywordUpsert).not.toHaveBeenCalled();
  });
});

describe('resetJobKeywordsV1 (no-LLM pipeline)', () => {
  it('strips every job_description_bin content out of each description, parses against the mv_tech vocabulary plus the forwarded tech/keyword, and upserts one row per job', async () => {
    jobDescriptionBinFetchAll.mockResolvedValue({
      result: [{ content: '福利制度' }, { content: '公司簡介' }],
    });
    mvTechFetchAll.mockResolvedValue({
      result: [{ keywords: ['react', 'vue'] }, { keywords: ['nestjs'] }],
    });
    jobFetchAll.mockResolvedValue({
      result: [
        { id: 'job-1', description: '公司簡介 we use React 福利制度' },
        { id: 'job-2', description: 'NestJS backend' },
      ],
    });
    parseKeywordsOut
      .mockReturnValueOnce({ keywords: ['react'], description_ch_en_ratio: 0.5 })
      .mockReturnValueOnce({ keywords: ['nestjs'], description_ch_en_ratio: 1 });

    await resetJobKeywordsV1('solidjs', 'solid-js');

    // Both bins removed, in both jobs, before parsing.
    expect(parseKeywordsOut).toHaveBeenCalledTimes(2);
    expect(parseKeywordsOut.mock.calls[0][0]).toBe(' we use React ');
    expect(parseKeywordsOut.mock.calls[1][0]).toBe('NestJS backend');
    // Vocabulary = every mv_tech row's keywords, flattened, plus the two
    // forwarded arguments.
    expect(parseKeywordsOut.mock.calls[0][1]).toEqual([
      'react',
      'vue',
      'nestjs',
      'solidjs',
      'solid-js',
    ]);

    expect(jobKeywordUpsert).toHaveBeenCalledTimes(1);
    expect(jobKeywordUpsert).toHaveBeenCalledWith([
      {
        id: 'job-1',
        keyword_groups: [],
        keywords: ['react'],
        description_ch_en_ratio: 0.5,
      },
      {
        id: 'job-2',
        keyword_groups: [],
        keywords: ['nestjs'],
        description_ch_en_ratio: 1,
      },
    ]);
  });

  it('passes the mv_tech vocabulary alone when no tech/keyword is forwarded', async () => {
    mvTechFetchAll.mockResolvedValue({ result: [{ keywords: ['react'] }] });
    jobFetchAll.mockResolvedValue({
      result: [{ id: 'job-1', description: 'React' }],
    });

    await resetJobKeywordsV1();

    expect(parseKeywordsOut.mock.calls[0][1]).toEqual(['react']);
  });

  it('builds the vocabulary from categorised techs only (mv_tech query filters category not-null)', async () => {
    jobFetchAll.mockResolvedValue({
      result: [{ id: 'job-1', description: 'React' }],
    });

    await resetJobKeywordsV1();

    expect(mvTechFetchAll).toHaveBeenCalledWith({
      where: { category: { 'not.is': null } },
    });
  });

  it('never touches the LLM path -- no model lookup, no client, no generateJobKeywordsFromLines', async () => {
    jobFetchAll.mockResolvedValue({
      result: [{ id: 'job-1', description: 'React' }],
    });

    await resetJobKeywordsV1();

    expect(getValue).not.toHaveBeenCalled();
    expect(openRouterLlmClientCtor).not.toHaveBeenCalled();
    expect(generateJobKeywordsFromLines).not.toHaveBeenCalled();
  });
});

describe('resetJobKeywords_Keywords_JobTech', () => {
  it('runs the V1 pipeline, then resetKeywords/MvTechService.refresh/JobTechService.resetByJobKeywords in that order (5.4)', async () => {
    const callOrder: string[] = [];
    jobFetchAll.mockResolvedValue({
      result: [{ id: 'job-1', description: 'React' }],
    });
    jobKeywordUpsert.mockImplementation(async () => {
      callOrder.push('resetJobKeywordsV1');
    });
    resetKeywords.mockImplementation(async () => {
      callOrder.push('resetKeywords');
    });
    mvTechRefresh.mockImplementation(async () => {
      callOrder.push('MvTechService.refresh');
    });
    resetByJobKeywords.mockImplementation(async () => {
      callOrder.push('JobTechService.resetByJobKeywords');
    });

    await resetJobKeywords_Keywords_JobTech('tech-x', 'keyword-y');

    expect(callOrder).toEqual([
      'resetJobKeywordsV1',
      'resetKeywords',
      'MvTechService.refresh',
      'JobTechService.resetByJobKeywords',
    ]);
    expect(jobKeywordUpsert).toHaveBeenCalledTimes(1);
    // The forwarded tech/keyword reach V1's parse vocabulary.
    expect(parseKeywordsOut.mock.calls[0][1]).toEqual(['tech-x', 'keyword-y']);
    expect(resetKeywords).toHaveBeenCalledTimes(1);
    expect(mvTechRefresh).toHaveBeenCalledTimes(1);
    expect(resetByJobKeywords).toHaveBeenCalledTimes(1);
  });

  it('routes through V1, not the LLM pipeline -- an admin reset makes no LLM call', async () => {
    jobFetchAll.mockResolvedValue({
      result: [{ id: 'job-1', description: 'React' }],
    });

    await resetJobKeywords_Keywords_JobTech();

    expect(jobKeywordUpsert).toHaveBeenCalledTimes(1);
    expect(generateJobKeywordsFromLines).not.toHaveBeenCalled();
    expect(openRouterLlmClientCtor).not.toHaveBeenCalled();
  });
});
