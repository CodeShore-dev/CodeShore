import type { KeywordGroup } from '@codeshore/data-types';
import type { LlmClient } from '@codeshore/ai-client';

/**
 * Same mocking convention as `job-keyword-line-extraction.spec.ts`: hand-
 * rolled fakes wired in via `vi.mock('./api/...')` on each service module,
 * since `generateJobDescriptionLines`/`generateJobDescriptionLineKeywords`
 * directly `new` their data services rather than receiving them via
 * constructor injection.
 */

const jobDescriptionBinFetchAll = vi.fn();
const mvTechFetchAll = vi.fn();
const jobFetchAll = vi.fn();
const lineServiceReplaceWhereIn = vi.fn().mockResolvedValue(undefined);
const lineServiceFindWhereIn = vi.fn();
const lineKeywordServiceReplaceWhereIn = vi.fn().mockResolvedValue(undefined);
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
    replaceWhereIn: lineServiceReplaceWhereIn,
    findWhereIn: lineServiceFindWhereIn,
  })),
}));

vi.mock('./api/job_description_line_keyword.service', () => ({
  JobDescriptionLineKeywordService: vi.fn().mockImplementation(() => ({
    replaceWhereIn: lineKeywordServiceReplaceWhereIn,
  })),
}));

import {
  generateJobDescriptionLineKeywords,
  generateJobDescriptionLines,
} from './job-description-line-extraction';

interface FakeJob {
  id: string;
  description?: string;
}

function setupJobDescriptionBins() {
  jobDescriptionBinFetchAll.mockResolvedValue({ result: [], count: 0, searchParams: '' });
}

function setupJobs(jobs: FakeJob[]) {
  jobFetchAll.mockResolvedValue({ result: jobs, count: jobs.length, searchParams: '' });
}

/** Always resolves ok:true, isCorrect:true (candidate set confirmed as-is) with single-member groups. */
function makeAlwaysCorrectLlmClient(groups?: KeywordGroup[]): LlmClient {
  return {
    completeStructured: vi.fn().mockResolvedValue({
      ok: true,
      result: {
        isCorrect: true,
        groups: groups ?? [],
        reasoning: 'looks right',
      },
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mvTechFetchAll.mockResolvedValue({ result: [], count: 0, searchParams: '' });
  lineServiceReplaceWhereIn.mockResolvedValue(undefined);
  lineKeywordServiceReplaceWhereIn.mockResolvedValue(undefined);
  jobKeywordUpsert.mockResolvedValue(undefined);
});

describe('generateJobDescriptionLines', () => {
  it('splits every job into non-blank lines and replaces only those jobs\' rows', async () => {
    setupJobDescriptionBins();
    setupJobs([{ id: 'job-1', description: 'React 前端工程師\n\n   \n3 年以上經驗' }]);
    // mvTechFetchAll returns [] in beforeEach (allGroupKeywords = []).
    // parseKeywordsOut on mixed Chinese/English text still extracts English words from the text
    // (non-highly-English path), so 'React 前端工程師' → ['react'] (passes filter),
    // and '3 年以上經驗' has no English words → [] (filtered out). Blank/whitespace lines
    // are dropped by splitDescriptionIntoLines before the keyword filter runs.

    await generateJobDescriptionLines();

    expect(lineServiceReplaceWhereIn).toHaveBeenCalledTimes(1);
    const [field, jobIds, rows] = lineServiceReplaceWhereIn.mock.calls[0];
    expect(field).toBe('job_id');
    expect(jobIds).toEqual(['job-1']);
    // 'React 前端工程師' passes (has 'react'); '3 年以上經驗' and blank/whitespace lines do not.
    expect(rows).toHaveLength(1);
    expect(rows[0].content).toBe('React 前端工程師');
    expect(rows.every((r: any) => r.job_id === 'job-1')).toBe(true);
  });

  it('only stores lines that contain at least one candidate keyword (pre-filter, req 1.1)', async () => {
    setupJobDescriptionBins();
    setupJobs([{ id: 'job-1', description: 'React 前端工程師\n\n   \n公司福利說明' }]);
    mvTechFetchAll.mockResolvedValue({
      result: [
        { id: 'tech-1', category: 'frontend_framework', keywords: ['react'] },
      ],
      count: 1,
      searchParams: '',
    });

    await generateJobDescriptionLines();

    const [, , rows] = lineServiceReplaceWhereIn.mock.calls[0];
    // Only 'React 前端工程師' contains a keyword ('react'); '公司福利說明' does not.
    expect(rows).toHaveLength(1);
    expect(rows[0].content).toBe('React 前端工程師');
    expect(rows[0].job_id).toBe('job-1');
  });

  it('skips lines with no candidate keywords and does not store them (req 1.2)', async () => {
    setupJobDescriptionBins();
    setupJobs([{ id: 'job-1', description: '公司簡介\n福利說明\nNode.js 後端工程師' }]);
    mvTechFetchAll.mockResolvedValue({
      result: [
        { id: 'tech-1', category: 'backend_runtime', keywords: ['node.js'] },
      ],
      count: 1,
      searchParams: '',
    });

    await generateJobDescriptionLines();

    const [, , rows] = lineServiceReplaceWhereIn.mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(rows[0].content).toBe('Node.js 後端工程師');
  });

  it('repeated run replaces all rows with the latest filtered set (req 1.3)', async () => {
    setupJobDescriptionBins();
    setupJobs([{ id: 'job-1', description: 'React 前端工程師' }]);
    mvTechFetchAll.mockResolvedValue({
      result: [{ id: 'tech-1', category: 'frontend_framework', keywords: ['react'] }],
      count: 1,
      searchParams: '',
    });

    await generateJobDescriptionLines();

    // replaceWhereIn is called (not insertAll), meaning it overwrites the old set.
    expect(lineServiceReplaceWhereIn).toHaveBeenCalledTimes(1);
    const [field] = lineServiceReplaceWhereIn.mock.calls[0];
    expect(field).toBe('job_id');
  });

  it('forwards the where filter to JobService.fetchAll so only matching jobs are processed', async () => {
    setupJobDescriptionBins();
    setupJobs([{ id: 'job-open', description: 'React 前端工程師' }]);
    mvTechFetchAll.mockResolvedValue({
      result: [{ id: 'tech-1', category: 'frontend_framework', keywords: ['react'] }],
      count: 1,
      searchParams: '',
    });
    const where = { closed: { eq: false } };

    await generateJobDescriptionLines({ where });

    expect(jobFetchAll).toHaveBeenCalledWith(
      expect.objectContaining({ where, select: 'id,description' }),
    );
    // Only the jobs JobService actually returned are ever in scope for the
    // scoped replace -- proves the function doesn't independently re-derive
    // "all jobs" behind the filter's back.
    const [, jobIds] = lineServiceReplaceWhereIn.mock.calls[0];
    expect(jobIds).toEqual(['job-open']);
  });

  it('never touches job_description_line_keyword or job_keyword', async () => {
    setupJobDescriptionBins();
    setupJobs([{ id: 'job-1', description: 'React 前端工程師' }]);
    mvTechFetchAll.mockResolvedValue({
      result: [{ id: 'tech-1', category: 'frontend_framework', keywords: ['react'] }],
      count: 1,
      searchParams: '',
    });

    await generateJobDescriptionLines();

    expect(lineKeywordServiceReplaceWhereIn).not.toHaveBeenCalled();
    expect(jobKeywordUpsert).not.toHaveBeenCalled();
  });

  it('strips job_description_bin noise before splitting into lines, same as the combined pipeline', async () => {
    jobDescriptionBinFetchAll.mockResolvedValue({
      result: [{ id: 'bin-1', content: 'CONFIDENTIAL ' }],
      count: 1,
      searchParams: '',
    });
    setupJobs([{ id: 'job-1', description: 'CONFIDENTIAL React 前端工程師' }]);
    mvTechFetchAll.mockResolvedValue({
      result: [{ id: 'tech-1', category: 'frontend_framework', keywords: ['react'] }],
      count: 1,
      searchParams: '',
    });

    await generateJobDescriptionLines();

    const [, , rows] = lineServiceReplaceWhereIn.mock.calls[0];
    expect(rows[0].content).toBe('React 前端工程師');
  });
});

describe('generateJobDescriptionLineKeywords', () => {
  it('rule-extracts and AI-reviews only the existing lines of jobs matched by where, without touching job_keyword', async () => {
    setupJobs([{ id: 'job-a' }]);
    mvTechFetchAll.mockResolvedValue({
      result: [
        { id: 'tech-1', category: 'frontend_framework', keywords: ['react'] },
      ],
      count: 1,
      searchParams: '',
    });
    lineServiceFindWhereIn.mockResolvedValue({
      result: [
        { id: 'line-1', job_id: 'job-a', line_no: 1, content: 'React 前端工程師', created_at: '' },
      ],
      count: 1,
      searchParams: '',
    });
    const groups: KeywordGroup[] = [{ category: 'frontend_framework', keywords: ['react'] }];

    await generateJobDescriptionLineKeywords({
      llmClient: makeAlwaysCorrectLlmClient(groups),
      where: { id: { eq: 'job-a' } },
    });

    expect(jobFetchAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { eq: 'job-a' } }, select: 'id' }),
    );
    expect(lineServiceFindWhereIn).toHaveBeenCalledWith('job_id', ['job-a']);

    expect(lineKeywordServiceReplaceWhereIn).toHaveBeenCalledTimes(1);
    const [field, lineIds, rows] = lineKeywordServiceReplaceWhereIn.mock.calls[0];
    expect(field).toBe('line_id');
    expect(lineIds).toEqual(['line-1']);
    expect(rows).toHaveLength(1);
    expect(rows[0].line_id).toBe('line-1');
    // Must store final_keyword_groups (not final_keywords).
    expect(rows[0]).not.toHaveProperty('final_keywords');
    expect(rows[0].final_keyword_groups).toBeDefined();

    // Requirement: this stage stops at job_description_line_keyword.
    expect(jobKeywordUpsert).not.toHaveBeenCalled();
  });

  it('writes final_keyword_groups as KeywordGroup[] on AI success (req 3.1)', async () => {
    setupJobs([{ id: 'job-a' }]);
    mvTechFetchAll.mockResolvedValue({
      result: [
        { id: 'tech-1', category: 'frontend_framework', keywords: ['react', 'vue.js'] },
      ],
      count: 1,
      searchParams: '',
    });
    lineServiceFindWhereIn.mockResolvedValue({
      result: [
        { id: 'line-1', job_id: 'job-a', line_no: 1, content: 'React 或 Vue.js 前端工程師', created_at: '' },
      ],
      count: 1,
      searchParams: '',
    });
    const groups: KeywordGroup[] = [
      { category: 'frontend_framework', keywords: ['react', 'vue.js'] },
    ];
    const llmClient: LlmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: { isCorrect: true, groups, reasoning: 'they are alternatives' },
      }),
    };

    await generateJobDescriptionLineKeywords({ llmClient });

    const rows = lineKeywordServiceReplaceWhereIn.mock.calls[0][2];
    expect(rows[0].ai_status).toBe('ok');
    expect(rows[0].ai_is_correct).toBe(true);
    expect(rows[0].final_keyword_groups).toEqual(groups);
  });

  it('uses fallback single-member groups per keyword and records ai_status "failed" when AI review fails (req 5.1, 5.2)', async () => {
    setupJobs([{ id: 'job-a' }]);
    mvTechFetchAll.mockResolvedValue({
      result: [
        { id: 'tech-1', category: 'frontend_framework', keywords: ['react'] },
      ],
      count: 1,
      searchParams: '',
    });
    lineServiceFindWhereIn.mockResolvedValue({
      result: [
        { id: 'line-1', job_id: 'job-a', line_no: 1, content: 'React 前端工程師', created_at: '' },
      ],
      count: 1,
      searchParams: '',
    });
    const llmClient: LlmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: false,
        error: 'OpenRouter API request failed: timeout',
      }),
    };

    await generateJobDescriptionLineKeywords({ llmClient });

    const rows = lineKeywordServiceReplaceWhereIn.mock.calls[0][2];
    expect(rows[0].ai_status).toBe('failed');
    expect(rows[0].ai_is_correct).toBeNull();
    // Fallback: each candidate keyword becomes a single-member group with category from keywordCategoryMap.
    expect(rows[0].final_keyword_groups).toEqual([
      { category: 'frontend_framework', keywords: ['react'] },
    ]);
    // rule_keywords is still the flat candidate list.
    expect(rows[0].rule_keywords).toEqual(['react']);
  });

  it('uses AI-returned groups when AI judges candidates correct (req 2.1, 2.2, 2.3)', async () => {
    setupJobs([{ id: 'job-a' }]);
    mvTechFetchAll.mockResolvedValue({
      result: [
        { id: 'tech-1', category: 'frontend_framework', keywords: ['react', 'vue.js'] },
        { id: 'tech-2', category: 'language', keywords: ['typescript'] },
      ],
      count: 2,
      searchParams: '',
    });
    lineServiceFindWhereIn.mockResolvedValue({
      result: [
        { id: 'line-1', job_id: 'job-a', line_no: 1, content: 'TypeScript, Vue.js 或 React.js 前端工程師', created_at: '' },
      ],
      count: 1,
      searchParams: '',
    });
    const aiGroups: KeywordGroup[] = [
      { category: 'language', keywords: ['typescript'] },
      { category: 'frontend_framework', keywords: ['vue.js', 'react'] },
    ];
    const llmClient: LlmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: { isCorrect: true, groups: aiGroups, reasoning: 'grouped correctly' },
      }),
    };

    await generateJobDescriptionLineKeywords({ llmClient });

    const rows = lineKeywordServiceReplaceWhereIn.mock.calls[0][2];
    expect(rows[0].ai_status).toBe('ok');
    expect(rows[0].final_keyword_groups).toEqual(aiGroups);
  });

  it('uses AI-corrected groups when AI judges candidates incorrect (req 2.3)', async () => {
    setupJobs([{ id: 'job-a' }]);
    mvTechFetchAll.mockResolvedValue({
      result: [
        { id: 'tech-1', category: 'frontend_framework', keywords: ['react'] },
        { id: 'tech-2', category: 'language', keywords: ['typescript'] },
      ],
      count: 2,
      searchParams: '',
    });
    lineServiceFindWhereIn.mockResolvedValue({
      result: [
        { id: 'line-1', job_id: 'job-a', line_no: 1, content: 'React 前端工程師', created_at: '' },
      ],
      count: 1,
      searchParams: '',
    });
    const correctedGroups: KeywordGroup[] = [
      { category: 'frontend_framework', keywords: ['react'] },
      { category: 'language', keywords: ['typescript'] },
    ];
    const llmClient: LlmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: { isCorrect: false, groups: correctedGroups, reasoning: 'missing typescript' },
      }),
    };

    await generateJobDescriptionLineKeywords({ llmClient });

    const rows = lineKeywordServiceReplaceWhereIn.mock.calls[0][2];
    expect(rows[0].ai_status).toBe('ok');
    expect(rows[0].ai_is_correct).toBe(false);
    expect(rows[0].final_keyword_groups).toEqual(correctedGroups);
  });

  it('does nothing (no AI calls, no write) when the where filter matches no jobs', async () => {
    setupJobs([]);
    lineServiceFindWhereIn.mockResolvedValue({ result: [], count: 0, searchParams: '' });
    const completeStructured = vi.fn();

    await generateJobDescriptionLineKeywords({
      llmClient: { completeStructured },
      where: { id: { eq: 'job-does-not-exist' } },
    });

    expect(lineServiceFindWhereIn).toHaveBeenCalledWith('job_id', []);
    expect(completeStructured).not.toHaveBeenCalled();
    const rows = lineKeywordServiceReplaceWhereIn.mock.calls[0][2];
    expect(rows).toEqual([]);
  });

  it('single line AI failure does not affect other lines (req 5.3)', async () => {
    setupJobs([{ id: 'job-a' }]);
    mvTechFetchAll.mockResolvedValue({
      result: [
        { id: 'tech-1', category: 'frontend_framework', keywords: ['react'] },
        { id: 'tech-2', category: 'backend_runtime', keywords: ['node.js'] },
      ],
      count: 2,
      searchParams: '',
    });
    lineServiceFindWhereIn.mockResolvedValue({
      result: [
        { id: 'line-1', job_id: 'job-a', line_no: 1, content: 'React 前端工程師', created_at: '' },
        { id: 'line-2', job_id: 'job-a', line_no: 2, content: 'Node.js 後端工程師', created_at: '' },
      ],
      count: 2,
      searchParams: '',
    });
    // First call fails, second succeeds.
    const completeStructured = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: 'timeout' })
      .mockResolvedValueOnce({
        ok: true,
        result: {
          isCorrect: true,
          groups: [{ category: 'backend_runtime', keywords: ['node.js'] }],
          reasoning: 'correct',
        },
      });

    await generateJobDescriptionLineKeywords({ llmClient: { completeStructured } });

    const rows = lineKeywordServiceReplaceWhereIn.mock.calls[0][2];
    expect(rows).toHaveLength(2);
    const failedRow = rows.find((r: any) => r.line_id === 'line-1');
    const successRow = rows.find((r: any) => r.line_id === 'line-2');
    expect(failedRow.ai_status).toBe('failed');
    expect(successRow.ai_status).toBe('ok');
    expect(successRow.final_keyword_groups).toEqual([
      { category: 'backend_runtime', keywords: ['node.js'] },
    ]);
  });

  it('passes keywordCategoryMap to the reviewer so AI can assign categories (req 2.2)', async () => {
    setupJobs([{ id: 'job-a' }]);
    mvTechFetchAll.mockResolvedValue({
      result: [
        { id: 'tech-1', category: 'frontend_framework', keywords: ['react', 'vue.js'] },
        { id: 'tech-2', category: 'language', keywords: ['typescript'] },
      ],
      count: 2,
      searchParams: '',
    });
    lineServiceFindWhereIn.mockResolvedValue({
      result: [
        { id: 'line-1', job_id: 'job-a', line_no: 1, content: 'TypeScript React 前端工程師', created_at: '' },
      ],
      count: 1,
      searchParams: '',
    });
    const completeStructured = vi.fn().mockResolvedValue({
      ok: true,
      result: {
        isCorrect: true,
        groups: [{ category: 'frontend_framework', keywords: ['react'] }],
        reasoning: 'ok',
      },
    });

    await generateJobDescriptionLineKeywords({ llmClient: { completeStructured } });

    // The reviewer must have been called with a keywordCategoryMap.
    expect(completeStructured).toHaveBeenCalledTimes(1);
    const callArg = completeStructured.mock.calls[0][0];
    // The input passed to completeStructured should include keywordCategoryMap.
    expect(callArg.input).toMatchObject({
      keywordCategoryMap: expect.objectContaining({
        'react': 'frontend_framework',
        'typescript': 'language',
      }),
    });
  });
});
