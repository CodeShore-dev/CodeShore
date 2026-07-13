/**
 * Task 3.1: `resetJobKeywords()`'s internals are replaced with a call into
 * the new `generateJobKeywordsFromLines()` batch orchestrator (task 2.2/2.3,
 * `./job-keyword-line-extraction.ts`) instead of the old inline
 * fetch/strip/`parseKeywordsOut`-per-job/`JobKeywordService().upsert()`
 * logic. `resetJobKeywords_Keywords_JobTech()` itself must keep calling
 * `resetJobKeywords()` -> `resetKeywords()` -> `MvTechService().refresh()`
 * -> `JobTechService().resetByJobKeywords()` in that exact order (design.md
 * 5.4, traceability row 5.4) -- this file proves both halves.
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
  resetByJobKeywords,
} = vi.hoisted(() => ({
  generateJobKeywordsFromLines: vi.fn(),
  getValue: vi.fn(),
  openRouterLlmClientCtor: vi.fn(),
  resetKeywords: vi.fn(),
  mvTechRefresh: vi.fn(),
  resetByJobKeywords: vi.fn(),
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
// real module so `resetJobKeywords`'s own `getValue(DEFAULT_MODEL_SETTING_KEY)`
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

vi.mock('./api/mv_tech', () => ({
  MvTechService: vi.fn().mockImplementation(() => ({
    refresh: mvTechRefresh,
  })),
}));

vi.mock('./api/job_tech.service', () => ({
  JobTechService: vi.fn().mockImplementation(() => ({
    resetByJobKeywords,
  })),
}));

import { DEFAULT_MODEL_FALLBACK, DEFAULT_MODEL_SETTING_KEY } from '@codeshore/ai-client';

import { resetJobKeywords, resetJobKeywords_Keywords_JobTech } from './data-utils';

beforeEach(() => {
  vi.clearAllMocks();
  generateJobKeywordsFromLines.mockResolvedValue(undefined);
  resetKeywords.mockResolvedValue(undefined);
  mvTechRefresh.mockResolvedValue(undefined);
  resetByJobKeywords.mockResolvedValue(undefined);
});

describe('resetJobKeywords', () => {
  it('resolves the model from AiLlmSettingService, builds an OpenRouterLlmClient with it, and delegates to generateJobKeywordsFromLines with the forwarded tech/keyword (5.2)', async () => {
    getValue.mockResolvedValue('some/configured-model');

    await resetJobKeywords('react', 'frontend');

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

    await resetJobKeywords();

    expect(openRouterLlmClientCtor).toHaveBeenCalledWith(DEFAULT_MODEL_FALLBACK);
    const options = generateJobKeywordsFromLines.mock.calls[0][0];
    expect(options.tech).toBeUndefined();
    expect(options.keyword).toBeUndefined();
  });

  it('no longer performs the old inline per-job extraction/upsert -- generateJobKeywordsFromLines is the only thing resetJobKeywords delegates to', async () => {
    getValue.mockResolvedValue('some/model');

    await resetJobKeywords();

    // The old body called JobDescriptionBinService/JobService/MvTechService
    // (via `fetchAll`) directly plus `JobKeywordService().upsert(...)`. This
    // test's module mocks for ai_llm_setting/ai-client/
    // job-keyword-line-extraction fully account for every call
    // resetJobKeywords makes -- if the old inline logic were still present,
    // its unmocked service calls would throw (no Supabase client available
    // in this test environment) well before this assertion.
    expect(generateJobKeywordsFromLines).toHaveBeenCalledTimes(1);
  });
});

describe('resetJobKeywords_Keywords_JobTech', () => {
  it('still triggers resetKeywords/MvTechService.refresh/JobTechService.resetByJobKeywords in order after the new resetJobKeywords pipeline runs (5.4)', async () => {
    getValue.mockResolvedValue('some/model');
    const callOrder: string[] = [];
    generateJobKeywordsFromLines.mockImplementation(async () => {
      callOrder.push('resetJobKeywords');
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
      'resetJobKeywords',
      'resetKeywords',
      'MvTechService.refresh',
      'JobTechService.resetByJobKeywords',
    ]);
    expect(generateJobKeywordsFromLines).toHaveBeenCalledTimes(1);
    const options = generateJobKeywordsFromLines.mock.calls[0][0];
    expect(options.tech).toBe('tech-x');
    expect(options.keyword).toBe('keyword-y');
    expect(resetKeywords).toHaveBeenCalledTimes(1);
    expect(mvTechRefresh).toHaveBeenCalledTimes(1);
    expect(resetByJobKeywords).toHaveBeenCalledTimes(1);
  });
});
