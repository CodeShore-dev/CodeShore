import type { KeywordGroup } from '@codeshore/data-types';
import type { LlmClient } from '@codeshore/ai-client';

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

function makeAlwaysOkLlmClient(groups?: KeywordGroup[]): LlmClient {
  return {
    completeStructured: vi.fn().mockResolvedValue({
      ok: true,
      result: {
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
  it('splits every job into non-blank lines — all non-blank lines are stored regardless of content', async () => {
    setupJobDescriptionBins();
    setupJobs([{ id: 'job-1', description: 'React 前端工程師\n\n   \n3 年以上經驗' }]);

    await generateJobDescriptionLines();

    expect(lineServiceReplaceWhereIn).toHaveBeenCalledTimes(1);
    const [field, jobIds, rows] = lineServiceReplaceWhereIn.mock.calls[0];
    expect(field).toBe('job_id');
    expect(jobIds).toEqual(['job-1']);
    // Both non-blank lines stored; blank/whitespace lines dropped.
    expect(rows).toHaveLength(2);
    expect(rows.map((r: any) => r.content)).toEqual(['React 前端工程師', '3 年以上經驗']);
    expect(rows.every((r: any) => r.job_id === 'job-1')).toBe(true);
  });

  it('stores all non-blank lines including those without tech keywords', async () => {
    setupJobDescriptionBins();
    setupJobs([{ id: 'job-1', description: 'React 前端工程師\n公司福利說明' }]);
    mvTechFetchAll.mockResolvedValue({
      result: [{ id: 'tech-1', category: 'frontend_framework', keywords: ['react'] }],
      count: 1,
      searchParams: '',
    });

    await generateJobDescriptionLines();

    const [, , rows] = lineServiceReplaceWhereIn.mock.calls[0];
    expect(rows).toHaveLength(2);
    expect(rows.map((r: any) => r.content)).toEqual(['React 前端工程師', '公司福利說明']);
  });

  it('repeated run replaces all rows with the latest set (req 1.3)', async () => {
    setupJobDescriptionBins();
    setupJobs([{ id: 'job-1', description: 'React 前端工程師' }]);

    await generateJobDescriptionLines();

    expect(lineServiceReplaceWhereIn).toHaveBeenCalledTimes(1);
    const [field] = lineServiceReplaceWhereIn.mock.calls[0];
    expect(field).toBe('job_id');
  });

  it('forwards the where filter to JobService.fetchAll so only matching jobs are processed', async () => {
    setupJobDescriptionBins();
    setupJobs([{ id: 'job-open', description: 'React 前端工程師' }]);
    const where = { closed: { eq: false } };

    await generateJobDescriptionLines({ where });

    expect(jobFetchAll).toHaveBeenCalledWith(
      expect.objectContaining({ where, select: 'id,description' }),
    );
    const [, jobIds] = lineServiceReplaceWhereIn.mock.calls[0];
    expect(jobIds).toEqual(['job-open']);
  });

  it('never touches job_description_line_keyword or job_keyword', async () => {
    setupJobDescriptionBins();
    setupJobs([{ id: 'job-1', description: 'React 前端工程師' }]);

    await generateJobDescriptionLines();

    expect(lineKeywordServiceReplaceWhereIn).not.toHaveBeenCalled();
    expect(jobKeywordUpsert).not.toHaveBeenCalled();
  });

  it('strips job_description_bin noise before splitting into lines', async () => {
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
  it('AI-reviews every existing line of jobs matched by where, without touching job_keyword', async () => {
    setupJobs([{ id: 'job-a' }]);
    mvTechFetchAll.mockResolvedValue({
      result: [{ id: 'tech-1', category: 'frontend_framework', keywords: ['react'] }],
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
      llmClient: makeAlwaysOkLlmClient(groups),
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
    expect(rows[0]).not.toHaveProperty('final_keywords');
    expect(rows[0].final_keyword_groups).toBeDefined();
    expect(jobKeywordUpsert).not.toHaveBeenCalled();
  });

  it('writes final_keyword_groups as KeywordGroup[] on AI success and sets ai_is_correct to null', async () => {
    setupJobs([{ id: 'job-a' }]);
    mvTechFetchAll.mockResolvedValue({
      result: [{ id: 'tech-1', category: 'frontend_framework', keywords: ['react', 'vue.js'] }],
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
    const groups: KeywordGroup[] = [{ category: 'frontend_framework', keywords: ['react', 'vue.js'] }];

    await generateJobDescriptionLineKeywords({ llmClient: makeAlwaysOkLlmClient(groups) });

    const rows = lineKeywordServiceReplaceWhereIn.mock.calls[0][2];
    expect(rows[0].ai_status).toBe('ok');
    expect(rows[0].ai_is_correct).toBeNull();
    expect(rows[0].final_keyword_groups).toEqual(groups);
    expect(rows[0].rule_keywords).toEqual([]);
  });

  it('records ai_status "failed" and empty final_keyword_groups when AI review fails', async () => {
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
    expect(rows[0].final_keyword_groups).toEqual([]);
    expect(rows[0].rule_keywords).toEqual([]);
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
    lineServiceFindWhereIn.mockResolvedValue({
      result: [
        { id: 'line-1', job_id: 'job-a', line_no: 1, content: 'React 前端工程師', created_at: '' },
        { id: 'line-2', job_id: 'job-a', line_no: 2, content: 'Node.js 後端工程師', created_at: '' },
      ],
      count: 2,
      searchParams: '',
    });
    const completeStructured = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: 'timeout' })
      .mockResolvedValueOnce({
        ok: true,
        result: {
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
    expect(failedRow.final_keyword_groups).toEqual([]);
    expect(successRow.ai_status).toBe('ok');
    expect(successRow.final_keyword_groups).toEqual([{ category: 'backend_runtime', keywords: ['node.js'] }]);
  });

  it('passes keywordCategoryMap to the reviewer so AI can assign categories', async () => {
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
        groups: [{ category: 'frontend_framework', keywords: ['react'] }],
        reasoning: 'ok',
      },
    });

    await generateJobDescriptionLineKeywords({ llmClient: { completeStructured } });

    expect(completeStructured).toHaveBeenCalledTimes(1);
    const callArg = completeStructured.mock.calls[0][0];
    expect(callArg.input).toMatchObject({
      keywordCategoryMap: expect.objectContaining({
        'react': 'frontend_framework',
        'typescript': 'language',
      }),
    });
  });
});
