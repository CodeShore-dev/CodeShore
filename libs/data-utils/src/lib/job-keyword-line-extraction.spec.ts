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
const jobKeywordUpsert = vi.fn().mockResolvedValue(undefined);

vi.mock('./api/job_description_bin.service', () => ({
  JobDescriptionBinService: vi.fn().mockImplementation(() => ({
    fetchAll: jobDescriptionBinFetchAll,
  })),
}));

vi.mock('./api/job_keyword.service', () => ({
  JobKeywordService: vi.fn().mockImplementation(() => ({
    upsert: jobKeywordUpsert,
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

/** Always resolves ok:true, isCorrect:true (candidate set confirmed as-is, empty groups). */
function makeAlwaysCorrectLlmClient(): LlmClient {
  return {
    completeStructured: vi.fn().mockResolvedValue({
      ok: true,
      result: { isCorrect: true, groups: [], reasoning: 'looks right' },
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  lineServiceReset.mockResolvedValue(undefined);
  lineKeywordServiceReset.mockResolvedValue(undefined);
  jobKeywordUpsert.mockResolvedValue(undefined);
});

describe('generateJobKeywordsFromLines', () => {
  it('does not produce a job_description_line record for blank lines', async () => {
    setupServices([
      { id: 'job-1', description: 'React 前端工程師\n\n   \nNode.js 後端工程師' },
    ]);

    await generateJobKeywordsFromLines({ llmClient: makeAlwaysCorrectLlmClient() });

    expect(lineServiceReset).toHaveBeenCalledTimes(1);
    const rows = lineServiceReset.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows.map((r: any) => r.content)).toEqual([
      'React 前端工程師',
      'Node.js 後端工程師',
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
    // Fallback: final_keyword_groups is built from rule_keywords (one group per keyword, category 'other'
    // since no techs are configured). The union of all keywords must match rule_keywords exactly.
    const fallbackKeywords = rows[0].final_keyword_groups.flatMap((g: any) => g.keywords).sort();
    expect(fallbackKeywords).toEqual([...rows[0].rule_keywords].sort());
  });

  it('adopts the AI-returned keyword set and records ai_status "ok" when the AI judges the candidates incorrect', async () => {
    setupServices([{ id: 'job-1', description: 'React 前端工程師' }]);
    const llmClient: LlmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          isCorrect: false,
          groups: [{ category: 'other', keywords: ['react', 'typescript'] }],
          reasoning: 'missing typescript',
        },
      }),
    };

    await generateJobKeywordsFromLines({ llmClient });

    const rows = lineKeywordServiceReset.mock.calls[0][0];
    expect(rows[0].ai_status).toBe('ok');
    expect(rows[0].ai_is_correct).toBe(false);
    expect(rows[0].final_keyword_groups).toEqual([{ category: 'other', keywords: ['react', 'typescript'] }]);
  });

  it('isolates a single failed line/job: other lines in the same job and other jobs still process normally', async () => {
    setupServices([
      { id: 'job-fail', description: 'React 前端工程師\nNode.js 後端工程師' },
      { id: 'job-ok', description: 'Python 後端開發工程師' },
    ]);

    // job-fail's first line fails, its second line and job-ok's line succeed.
    const completeStructured = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'timeout' })
      .mockResolvedValueOnce({
        ok: true,
        result: { isCorrect: true, groups: [], reasoning: 'ok' },
      })
      .mockResolvedValueOnce({
        ok: true,
        result: { isCorrect: true, groups: [], reasoning: 'ok' },
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
    // Fallback: final_keyword_groups is built from rule_keywords (one group per keyword, category 'other').
    // The union of all keywords in the groups must match rule_keywords exactly.
    const failedFallbackKeywords = failedRow.final_keyword_groups.flatMap((g: any) => g.keywords).sort();
    expect(failedFallbackKeywords).toEqual([...failedRow.rule_keywords].sort());

    const okRows = reviewRows.filter((r: any) => r.ai_status === 'ok');
    expect(okRows).toHaveLength(2);
  });

  it('keeps the number of concurrently in-flight AI review calls within the configured concurrency limit', async () => {
    const jobs = Array.from({ length: 6 }, (_, i) => ({
      id: `job-${i}`,
      description: `React 前端工程師 ${i}`,
    }));
    setupServices(jobs);

    let current = 0;
    let peak = 0;
    const completeStructured = vi.fn().mockImplementation(async () => {
      current += 1;
      peak = Math.max(peak, current);
      await new Promise(resolve => setTimeout(resolve, 15));
      current -= 1;
      return { ok: true, result: { isCorrect: true, groups: [], reasoning: 'ok' } };
    });
    const llmClient: LlmClient = { completeStructured };

    await generateJobKeywordsFromLines({ llmClient, concurrency: 2 });

    expect(completeStructured).toHaveBeenCalledTimes(6);
    expect(peak).toBeLessThanOrEqual(2);
    // Sanity check the fake actually exercised concurrency (not fully serial).
    expect(peak).toBeGreaterThan(1);
  });

  it('aggregates a job\'s multiple lines into one deduped keyword set and upserts it with description_ch_en_ratio (5.1, 5.2)', async () => {
    setupServices([{ id: 'job-1', description: 'React 前端工程師\nReact TypeScript 開發' }]);
    // Both lines' rule-extracted candidate sets are accepted as-is
    // (isCorrect: true), so line 1 -> ['react'], line 2 -> ['react', 'typescript']
    // once run through the real `parseKeywordsOut`/tech matching -- to keep
    // this test independent of that matching logic, force the AI review
    // result to return overlapping keyword sets directly via isCorrect:false.
    const completeStructured = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        result: {
          isCorrect: false,
          groups: [{ category: 'other', keywords: ['react', 'typescript'] }],
          reasoning: 'line 1',
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        result: {
          isCorrect: false,
          groups: [{ category: 'other', keywords: ['typescript', 'react'] }],
          reasoning: 'line 2 (duplicate)',
        },
      });
    const llmClient: LlmClient = { completeStructured };

    await generateJobKeywordsFromLines({ llmClient });

    expect(jobKeywordUpsert).toHaveBeenCalledTimes(1);
    const upsertRows = jobKeywordUpsert.mock.calls[0][0];
    expect(upsertRows).toHaveLength(1);
    expect(upsertRows[0].id).toBe('job-1');
    expect(upsertRows[0].keywords.slice().sort()).toEqual(['react', 'typescript']);
    expect(typeof upsertRows[0].description_ch_en_ratio).toBe('number');
    // Shape matches SupabaseTable.Job_.Keyword (id, keywords, description_ch_en_ratio, keyword_groups).
    expect(Object.keys(upsertRows[0]).sort()).toEqual(
      ['description_ch_en_ratio', 'id', 'keyword_groups', 'keywords'].sort(),
    );
  });

  it('produces an empty keywords array (not an omitted row) for a job with no valid lines (5.3)', async () => {
    setupServices([{ id: 'job-blank', description: '   \n\n   ' }]);

    await generateJobKeywordsFromLines({ llmClient: makeAlwaysCorrectLlmClient() });

    expect(jobKeywordUpsert).toHaveBeenCalledTimes(1);
    const upsertRows = jobKeywordUpsert.mock.calls[0][0];
    expect(upsertRows).toHaveLength(1);
    expect(upsertRows[0].id).toBe('job-blank');
    expect(upsertRows[0].keywords).toEqual([]);
  });

  it('upserts one row per job across the whole batch, each carrying its own description_ch_en_ratio', async () => {
    setupServices([
      { id: 'job-a', description: 'React 前端工程師甲' },
      { id: 'job-b', description: 'Node.js 後端工程師乙' },
    ]);

    await generateJobKeywordsFromLines({ llmClient: makeAlwaysCorrectLlmClient() });

    expect(jobKeywordUpsert).toHaveBeenCalledTimes(1);
    const upsertRows = jobKeywordUpsert.mock.calls[0][0];
    expect(upsertRows).toHaveLength(2);
    expect(upsertRows.map((r: any) => r.id).sort()).toEqual(['job-a', 'job-b']);
  });

  it('does not store or review lines with no candidate keywords', async () => {
    // Description has one non-keyword line (pure Chinese, no English tokens)
    // and one line with a keyword (React). Only the keyword line should be
    // stored and sent to AI review (requirements 1.1, 1.2).
    setupServices([
      { id: 'job-1', description: '我們提供優良的工作環境\nReact 前端工程師' },
    ]);

    await generateJobKeywordsFromLines({ llmClient: makeAlwaysCorrectLlmClient() });

    expect(lineServiceReset).toHaveBeenCalledTimes(1);
    const lineRows = lineServiceReset.mock.calls[0][0];
    // The non-keyword line must NOT be stored.
    expect(lineRows).toHaveLength(1);
    expect(lineRows[0].content).toBe('React 前端工程師');

    // AI reviewer must NOT be called for the non-keyword line.
    expect(lineKeywordServiceReset).toHaveBeenCalledTimes(1);
    const reviewRows = lineKeywordServiceReset.mock.calls[0][0];
    expect(reviewRows).toHaveLength(1);
  });
});
