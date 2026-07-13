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
  mvTechFetchAll.mockResolvedValue({ result: [], count: 0, searchParams: '' });
  lineServiceReplaceWhereIn.mockResolvedValue(undefined);
  lineKeywordServiceReplaceWhereIn.mockResolvedValue(undefined);
  jobKeywordUpsert.mockResolvedValue(undefined);
});

describe('generateJobDescriptionLines', () => {
  it('splits every job into non-blank lines and replaces only those jobs\' rows', async () => {
    setupJobDescriptionBins();
    setupJobs([{ id: 'job-1', description: 'React 前端工程師\n\n   \n3 年以上經驗' }]);

    await generateJobDescriptionLines();

    expect(lineServiceReplaceWhereIn).toHaveBeenCalledTimes(1);
    const [field, jobIds, rows] = lineServiceReplaceWhereIn.mock.calls[0];
    expect(field).toBe('job_id');
    expect(jobIds).toEqual(['job-1']);
    expect(rows).toHaveLength(2);
    expect(rows.map((r: any) => r.content)).toEqual([
      'React 前端工程師',
      '3 年以上經驗',
    ]);
    expect(rows.every((r: any) => r.job_id === 'job-1')).toBe(true);
  });

  it('forwards the where filter to JobService.fetchAll so only matching jobs are processed', async () => {
    setupJobDescriptionBins();
    setupJobs([{ id: 'job-open', description: 'line one' }]);
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
    setupJobs([{ id: 'job-1', description: 'line one' }]);

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

    await generateJobDescriptionLines();

    const [, , rows] = lineServiceReplaceWhereIn.mock.calls[0];
    expect(rows[0].content).toBe('React 前端工程師');
  });
});

describe('generateJobDescriptionLineKeywords', () => {
  it('rule-extracts and AI-reviews only the existing lines of jobs matched by where, without touching job_keyword', async () => {
    setupJobs([{ id: 'job-a' }]);
    lineServiceFindWhereIn.mockResolvedValue({
      result: [
        { id: 'line-1', job_id: 'job-a', line_no: 1, content: 'React 前端工程師', created_at: '' },
      ],
      count: 1,
      searchParams: '',
    });

    await generateJobDescriptionLineKeywords({
      llmClient: makeAlwaysCorrectLlmClient(),
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

    // Requirement: this stage stops at job_description_line_keyword.
    expect(jobKeywordUpsert).not.toHaveBeenCalled();
  });

  it('degrades to the rule-based candidate set and records ai_status "failed" when the AI review call fails', async () => {
    setupJobs([{ id: 'job-a' }]);
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
    expect(rows[0].final_keywords).toEqual(rows[0].rule_keywords);
  });

  it('adopts the AI-returned keyword set when the AI judges the candidates incorrect', async () => {
    setupJobs([{ id: 'job-a' }]);
    lineServiceFindWhereIn.mockResolvedValue({
      result: [
        { id: 'line-1', job_id: 'job-a', line_no: 1, content: 'React 前端工程師', created_at: '' },
      ],
      count: 1,
      searchParams: '',
    });
    const llmClient: LlmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: { isCorrect: false, keywords: ['react', 'typescript'], reasoning: 'missing typescript' },
      }),
    };

    await generateJobDescriptionLineKeywords({ llmClient });

    const rows = lineKeywordServiceReplaceWhereIn.mock.calls[0][2];
    expect(rows[0].ai_status).toBe('ok');
    expect(rows[0].ai_is_correct).toBe(false);
    expect(rows[0].final_keywords).toEqual(['react', 'typescript']);
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
});
