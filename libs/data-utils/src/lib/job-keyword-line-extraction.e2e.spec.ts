import type { LlmClient } from '@codeshore/ai-client';

/**
 * End-to-end integration test for `generateJobKeywordsFromLines` (task 4.1).
 *
 * Unlike `job-keyword-line-extraction.spec.ts`'s 8 unit tests -- each of
 * which isolates a single behavior (one job, one or two lines) -- this file
 * runs ONE realistic multi-job batch through the whole function and asserts
 * on the exact rows written to all three destination services in a single
 * run, proving the pieces compose correctly together:
 *
 *   - Job A: 4 description lines (one blank), exercising isCorrect:true
 *     ("keep candidate"), isCorrect:false ("adopt AI adjustment", including
 *     AI introducing a keyword absent from the rule-based candidate set),
 *     and a same-job cross-line keyword duplicate that must be deduped in
 *     the final `job_keyword.keywords`.
 *   - Job B: 2 lines, one AI success and one AI failure -- proving the
 *     failure degrades only that line (rule-based fallback, ai_status
 *     'failed') without affecting Job B's own successful line or any of Job
 *     A's already-processed lines (requirement 4.3's cross-job isolation).
 *   - Job C: an entirely blank description -- zero `job_description_line`
 *     rows, yet still a `job_keyword` row with `keywords: []` (5.3).
 *
 * Follows the same `vi.mock('./api/...')` fake-service convention as
 * `job-keyword-line-extraction.spec.ts` (own module-level mocks, since
 * `vi.mock` is hoisted per test file).
 *
 * Rule-keyword predictability: `MvTechService().fetchAll()` is faked to
 * return a single tech row with a fixed `keywords` list. All fixture line
 * text is composed so `checkHighlyEnglish` classifies it "highly English"
 * (chinese-char ratio 0, well under the 0.4 threshold), which routes
 * `parseKeywordsOut` through `scanKeywordsFromGroups` -- a simple
 * "does this known keyword appear in the text" filter against that fixed
 * list, with no word-tokenization ambiguity. This keeps `rule_keywords`
 * fully deterministic without needing to model the non-English branch's
 * (unrelated, more complex) HTML/regex tokenization.
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

const KNOWN_TECH_KEYWORDS = ['python', 'typescript', 'react', 'node', 'vue'];

function setupServices(jobs: FakeJob[]) {
  jobDescriptionBinFetchAll.mockResolvedValue({ result: [], count: 0, searchParams: '' });
  mvTechFetchAll.mockResolvedValue({
    result: [{ keywords: KNOWN_TECH_KEYWORDS, category: 'lang' }],
    count: 1,
    searchParams: '',
  });
  jobFetchAll.mockResolvedValue({ result: jobs, count: jobs.length, searchParams: '' });
}

beforeEach(() => {
  vi.clearAllMocks();
  lineServiceReset.mockResolvedValue(undefined);
  lineKeywordServiceReset.mockResolvedValue(undefined);
  jobKeywordUpsert.mockResolvedValue(undefined);
});

describe('generateJobKeywordsFromLines (end-to-end, task 4.1)', () => {
  it('processes a mixed multi-job batch correctly: per-line rows, per-line AI outcomes, cross-line dedup, cross-job AI-failure isolation, and empty-keyword job (1.1-1.4, 2.1-2.2, 3.1-3.4, 4.1-4.3, 5.1-5.3)', async () => {
    setupServices([
      {
        id: 'job-a',
        description: [
          'Requires 3+ years of Python experience.', // line 1: rule -> ['python'], AI isCorrect:true
          '   ', // line 2: blank -> no job_description_line row, but line_no gap preserved
          'Build features using TypeScript and React.', // line 3: rule -> ['typescript','react'], AI isCorrect:false -> adds 'graphql'
          'Node integration and TypeScript services.', // line 4: rule -> ['typescript','node'], AI isCorrect:false -> drops to ['typescript'] (duplicates line 3's 'typescript')
        ].join('\n'),
      },
      {
        id: 'job-b',
        description: [
          'Vue frontend engineering role.', // line 1: rule -> ['vue'], AI isCorrect:true
          'Vue backend integration work.', // line 2: rule -> ['vue'], AI call fails -> degrades to ['vue'], ai_status 'failed'
        ].join('\n'),
      },
      {
        id: 'job-c',
        description: '   \n  \n\t\n', // entirely blank -> zero valid lines
      },
    ]);

    const completeStructured = vi
      .fn()
      // job-a line 1 ("Requires 3+ years of Python experience.")
      .mockResolvedValueOnce({
        ok: true,
        result: { isCorrect: true, keywords: [], reasoning: 'python confirmed' },
      })
      // job-a line 3 ("Build features using TypeScript and React.")
      .mockResolvedValueOnce({
        ok: true,
        result: {
          isCorrect: false,
          keywords: ['typescript', 'react', 'graphql'],
          reasoning: 'also mentions GraphQL implicitly via API design context',
        },
      })
      // job-a line 4 ("Node integration and TypeScript services.")
      .mockResolvedValueOnce({
        ok: true,
        result: {
          isCorrect: false,
          keywords: ['typescript'],
          reasoning: 'node here refers to a generic term, not Node.js',
        },
      })
      // job-b line 1 ("Vue frontend engineering role.")
      .mockResolvedValueOnce({
        ok: true,
        result: { isCorrect: true, keywords: [], reasoning: 'vue confirmed' },
      })
      // job-b line 2 ("Vue backend integration work.") -- AI call fails
      .mockResolvedValueOnce({
        ok: false,
        error: 'OpenRouter API request failed: timeout',
      });
    const llmClient: LlmClient = { completeStructured };

    await generateJobKeywordsFromLines({ llmClient });

    expect(completeStructured).toHaveBeenCalledTimes(5);

    // ---- job_description_line rows ----------------------------------
    expect(lineServiceReset).toHaveBeenCalledTimes(1);
    const lineRows: any[] = lineServiceReset.mock.calls[0][0];

    // 3 lines for job-a (blank line 2 produced no row) + 2 for job-b + 0 for job-c.
    expect(lineRows).toHaveLength(5);

    const jobALines = lineRows
      .filter(r => r.job_id === 'job-a')
      .sort((a, b) => a.line_no - b.line_no);
    expect(jobALines.map(r => r.line_no)).toEqual([1, 3, 4]); // line 2 (blank) gap preserved
    expect(jobALines.map(r => r.content)).toEqual([
      'Requires 3+ years of Python experience.',
      'Build features using TypeScript and React.',
      'Node integration and TypeScript services.',
    ]);
    // No blank/whitespace-only content ever reaches job_description_line.
    expect(lineRows.every(r => r.content.trim().length > 0)).toBe(true);

    const jobBLines = lineRows
      .filter(r => r.job_id === 'job-b')
      .sort((a, b) => a.line_no - b.line_no);
    expect(jobBLines.map(r => r.line_no)).toEqual([1, 2]);
    expect(jobBLines.map(r => r.content)).toEqual([
      'Vue frontend engineering role.',
      'Vue backend integration work.',
    ]);

    // job-c's entirely-blank description produced zero line rows.
    expect(lineRows.filter(r => r.job_id === 'job-c')).toHaveLength(0);

    // ---- job_description_line_keyword rows ---------------------------
    expect(lineKeywordServiceReset).toHaveBeenCalledTimes(1);
    const reviewRows: any[] = lineKeywordServiceReset.mock.calls[0][0];
    expect(reviewRows).toHaveLength(5);

    // Build a lookup from line_id -> line row so review rows can be
    // correlated back to their originating job/line_no/content.
    const lineById = new Map(lineRows.map(r => [r.id, r]));

    function reviewRowFor(jobId: string, lineNo: number) {
      const row = reviewRows.find(r => {
        const line = lineById.get(r.line_id);
        return line?.job_id === jobId && line?.line_no === lineNo;
      });
      expect(row).toBeDefined();
      return row;
    }

    // job-a line 1: AI isCorrect:true -> candidate kept verbatim.
    const jobALine1 = reviewRowFor('job-a', 1);
    expect(jobALine1.rule_keywords).toEqual(['python']);
    expect(jobALine1.ai_status).toBe('ok');
    expect(jobALine1.ai_is_correct).toBe(true);
    expect(jobALine1.final_keywords).toEqual(jobALine1.rule_keywords);

    // job-a line 3: AI isCorrect:false -> adopts AI's adjusted set (which
    // adds a keyword, 'graphql', absent from the rule-based candidate set).
    const jobALine3 = reviewRowFor('job-a', 3);
    expect(jobALine3.rule_keywords).toEqual(['typescript', 'react']);
    expect(jobALine3.ai_status).toBe('ok');
    expect(jobALine3.ai_is_correct).toBe(false);
    expect(jobALine3.final_keywords).toEqual(['typescript', 'react', 'graphql']);

    // job-a line 4: AI isCorrect:false -> adopts AI's adjusted (narrower) set.
    const jobALine4 = reviewRowFor('job-a', 4);
    expect(jobALine4.rule_keywords).toEqual(['typescript', 'node']);
    expect(jobALine4.ai_status).toBe('ok');
    expect(jobALine4.ai_is_correct).toBe(false);
    expect(jobALine4.final_keywords).toEqual(['typescript']);

    // job-b line 1: AI isCorrect:true -> candidate kept verbatim. Proves
    // job-a's lines didn't leak state into job-b's processing.
    const jobBLine1 = reviewRowFor('job-b', 1);
    expect(jobBLine1.rule_keywords).toEqual(['vue']);
    expect(jobBLine1.ai_status).toBe('ok');
    expect(jobBLine1.ai_is_correct).toBe(true);
    expect(jobBLine1.final_keywords).toEqual(['vue']);

    // job-b line 2: AI call failed -> degrades to the rule-based candidate
    // set, ai_status recorded as 'failed', ai_is_correct null (4.1, 4.2).
    const jobBLine2 = reviewRowFor('job-b', 2);
    expect(jobBLine2.rule_keywords).toEqual(['vue']);
    expect(jobBLine2.ai_status).toBe('failed');
    expect(jobBLine2.ai_is_correct).toBeNull();
    expect(jobBLine2.final_keywords).toEqual(jobBLine2.rule_keywords);

    // job-b line 1 (processed just before the failing line 2) is unaffected
    // by line 2's failure -- proving same-job isolation (4.3).
    expect(jobBLine1.ai_status).toBe('ok');

    // ---- job_keyword rows (aggregate + dedupe) ------------------------
    expect(jobKeywordUpsert).toHaveBeenCalledTimes(1);
    const keywordRows: any[] = jobKeywordUpsert.mock.calls[0][0];
    expect(keywordRows).toHaveLength(3);
    expect(keywordRows.map(r => r.id).sort()).toEqual(['job-a', 'job-b', 'job-c']);

    const jobAKeywords = keywordRows.find(r => r.id === 'job-a');
    // ['python'] + ['typescript','react','graphql'] + ['typescript'],
    // deduped -- 'typescript' collapses from 2 occurrences to 1.
    expect(jobAKeywords.keywords.slice().sort()).toEqual(
      ['graphql', 'python', 'react', 'typescript'].sort(),
    );
    expect(new Set(jobAKeywords.keywords).size).toBe(jobAKeywords.keywords.length);
    expect(typeof jobAKeywords.description_ch_en_ratio).toBe('number');

    const jobBKeywords = keywordRows.find(r => r.id === 'job-b');
    // ['vue'] (line 1, ok) + ['vue'] (line 2, degraded) -- same-job dedup
    // collapses the coincidental duplicate to a single entry. job-b's AI
    // failure on line 2 did not drop or corrupt line 1's contribution.
    expect(jobBKeywords.keywords).toEqual(['vue']);
    expect(typeof jobBKeywords.description_ch_en_ratio).toBe('number');

    // job-c has no valid lines at all -> empty keyword array, not an
    // omitted row (5.3).
    const jobCKeywords = keywordRows.find(r => r.id === 'job-c');
    expect(jobCKeywords).toBeDefined();
    expect(jobCKeywords.keywords).toEqual([]);
    expect(typeof jobCKeywords.description_ch_en_ratio).toBe('number');

    // Every job_keyword row carries exactly the existing 3-field shape.
    for (const row of keywordRows) {
      expect(Object.keys(row).sort()).toEqual(
        ['description_ch_en_ratio', 'id', 'keywords'].sort(),
      );
    }
  });
});
