import type { LlmClient } from '@codeshore/ai-client';

/**
 * Follows the `keyword-mapping.generator.spec.ts` mocking convention (hand-
 * rolled fake services, no real Supabase client, no real HTTP) adapted to
 * this function's shape: `generateJobKeywordsFromLines` mirrors
 * `resetJobKeywords`'s existing pattern of directly `new`-ing its data
 * services rather than receiving them via constructor injection (design.md's
 * `GenerateJobKeywordsOptions` has no service-injection parameters), so the
 * fakes are wired in via `vi.mock('./api/...')` on each service module --
 * the same technique `job_description_line.spec.ts` already uses to fake out
 * `@codeshore/supabase` underneath a real service class, just one layer up.
 */

const jobDescriptionBinFetchAll = vi.fn();
const mvTechFetchAll = vi.fn();
const jobFetchAll = vi.fn();
const lineServiceReset = vi.fn().mockResolvedValue(undefined);
const lineKeywordServiceReset = vi.fn().mockResolvedValue(undefined);

vi.mock('./api/job_description_bin.service', () => ({
  JobDescriptionBinService: vi.fn().mockImplementation(() => ({
    fetchAll: jobDescriptionBinFetchAll,
  })),
}));

vi.mock('./api/mv_tech', () => ({
  MvTechService: vi.fn().mockImplementation(() => ({
    fetchAll: mvTechFetchAll,
  })),
}));

vi.mock('./api/job.service', () => ({
  JobService: vi.fn().mockImplementation(() => ({
    fetchAll: jobFetchAll,
  })),
}));

vi.mock('./api/job_description_line.service', () => ({
  JobDescriptionLineService: vi.fn().mockImplementation(() => ({
    reset: lineServiceReset,
  })),
}));

vi.mock('./api/job_description_line_keyword.service', () => ({
  JobDescriptionLineKeywordService: vi.fn().mockImplementation(() => ({
    reset: lineKeywordServiceReset,
  })),
}));

import { generateJobKeywordsFromLines } from './job-keyword-line-extraction';

interface FakeJob {
  id: string;
  description: string;
}

function setupServices(jobs: FakeJob[]) {
  jobDescriptionBinFetchAll.mockResolvedValue({ result: [], count: 0, searchParams: '' });
  mvTechFetchAll.mockResolvedValue({ result: [], count: 0, searchParams: '' });
  jobFetchAll.mockResolvedValue({ result: jobs, count: jobs.length, searchParams: '' });
}

/** Always resolves ok:true, isCorrect:true (candidate set confirmed as-is). */
function makeAlwaysCorrectLlmClient(): LlmClient {
  return {
    completeStructured: vi.fn().mockResolvedValue({
      ok: true,
      result: { isCorrect: true, keywords: [], reasoning: 'looks right' },
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  lineServiceReset.mockResolvedValue(undefined);
  lineKeywordServiceReset.mockResolvedValue(undefined);
});

describe('generateJobKeywordsFromLines', () => {
  it('does not produce a job_description_line record for blank lines', async () => {
    setupServices([
      { id: 'job-1', description: 'React 前端工程師\n\n   \n3 年以上經驗' },
    ]);

    await generateJobKeywordsFromLines({ llmClient: makeAlwaysCorrectLlmClient() });

    expect(lineServiceReset).toHaveBeenCalledTimes(1);
    const rows = lineServiceReset.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows.map((r: any) => r.content)).toEqual([
      'React 前端工程師',
      '3 年以上經驗',
    ]);
    expect(rows.every((r: any) => r.content.trim().length > 0)).toBe(true);
  });

  it('falls back to the candidate keyword set and records ai_status "failed" when the AI review call fails', async () => {
    setupServices([{ id: 'job-1', description: 'React 前端工程師' }]);
    const llmClient: LlmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: false,
        error: 'OpenRouter API request failed: timeout',
      }),
    };

    await generateJobKeywordsFromLines({ llmClient });

    expect(lineKeywordServiceReset).toHaveBeenCalledTimes(1);
    const rows = lineKeywordServiceReset.mock.calls[0][0];
    expect(rows).toHaveLength(1);
    expect(rows[0].ai_status).toBe('failed');
    expect(rows[0].ai_is_correct).toBeNull();
    expect(rows[0].final_keywords).toEqual(rows[0].rule_keywords);
  });

  it('adopts the AI-returned keyword set and records ai_status "ok" when the AI judges the candidates incorrect', async () => {
    setupServices([{ id: 'job-1', description: 'React 前端工程師' }]);
    const llmClient: LlmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: { isCorrect: false, keywords: ['react', 'typescript'], reasoning: 'missing typescript' },
      }),
    };

    await generateJobKeywordsFromLines({ llmClient });

    const rows = lineKeywordServiceReset.mock.calls[0][0];
    expect(rows[0].ai_status).toBe('ok');
    expect(rows[0].ai_is_correct).toBe(false);
    expect(rows[0].final_keywords).toEqual(['react', 'typescript']);
  });

  it('isolates a single failed line/job: other lines in the same job and other jobs still process normally', async () => {
    setupServices([
      { id: 'job-fail', description: 'line one\nline two' },
      { id: 'job-ok', description: 'line three' },
    ]);

    // job-fail's first line fails, its second line and job-ok's line succeed.
    const completeStructured = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'timeout' })
      .mockResolvedValueOnce({
        ok: true,
        result: { isCorrect: true, keywords: [], reasoning: 'ok' },
      })
      .mockResolvedValueOnce({
        ok: true,
        result: { isCorrect: true, keywords: [], reasoning: 'ok' },
      });
    const llmClient: LlmClient = { completeStructured };

    await generateJobKeywordsFromLines({ llmClient });

    expect(completeStructured).toHaveBeenCalledTimes(3);

    // All 3 lines still produced a job_description_line row.
    const lineRows = lineServiceReset.mock.calls[0][0];
    expect(lineRows).toHaveLength(3);

    // All 3 lines still produced a review row -- the failure did not abort
    // the batch or drop sibling lines/jobs.
    const reviewRows = lineKeywordServiceReset.mock.calls[0][0];
    expect(reviewRows).toHaveLength(3);

    const failedRow = reviewRows.find((r: any) => r.ai_status === 'failed');
    expect(failedRow).toBeDefined();
    expect(failedRow.final_keywords).toEqual(failedRow.rule_keywords);

    const okRows = reviewRows.filter((r: any) => r.ai_status === 'ok');
    expect(okRows).toHaveLength(2);
  });

  it('keeps the number of concurrently in-flight AI review calls within the configured concurrency limit', async () => {
    const jobs = Array.from({ length: 6 }, (_, i) => ({
      id: `job-${i}`,
      description: `line for job ${i}`,
    }));
    setupServices(jobs);

    let current = 0;
    let peak = 0;
    const completeStructured = vi.fn().mockImplementation(async () => {
      current += 1;
      peak = Math.max(peak, current);
      await new Promise(resolve => setTimeout(resolve, 15));
      current -= 1;
      return { ok: true, result: { isCorrect: true, keywords: [], reasoning: 'ok' } };
    });
    const llmClient: LlmClient = { completeStructured };

    await generateJobKeywordsFromLines({ llmClient, concurrency: 2 });

    expect(completeStructured).toHaveBeenCalledTimes(6);
    expect(peak).toBeLessThanOrEqual(2);
    // Sanity check the fake actually exercised concurrency (not fully serial).
    expect(peak).toBeGreaterThan(1);
  });
});
