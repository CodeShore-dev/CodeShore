import type { LlmClient } from '@codeshore/ai-client';

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

function makeAlwaysOkLlmClient(): LlmClient {
  return {
    completeStructured: vi.fn().mockResolvedValue({
      ok: true,
      result: { groups: [], reasoning: 'no keywords' },
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

    await generateJobKeywordsFromLines({ llmClient: makeAlwaysOkLlmClient() });

    expect(lineServiceReset).toHaveBeenCalledTimes(1);
    const rows = lineServiceReset.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows.map((r: any) => r.content)).toEqual([
      'React 前端工程師',
      'Node.js 後端工程師',
    ]);
  });

  it('stores all non-blank lines regardless of content (no keyword pre-filter)', async () => {
    setupServices([
      { id: 'job-1', description: '我們提供優良的工作環境\nReact 前端工程師' },
    ]);

    await generateJobKeywordsFromLines({ llmClient: makeAlwaysOkLlmClient() });

    const lineRows = lineServiceReset.mock.calls[0][0];
    expect(lineRows).toHaveLength(2);
    expect(lineRows.map((r: any) => r.content)).toEqual([
      '我們提供優良的工作環境',
      'React 前端工程師',
    ]);

    // AI reviewer is called for every stored line.
    const reviewRows = lineKeywordServiceReset.mock.calls[0][0];
    expect(reviewRows).toHaveLength(2);
  });

  it('records ai_status "failed" and empty final_keyword_groups when the AI review call fails', async () => {
    setupServices([{ id: 'job-1', description: 'React 前端工程師' }]);
    const llmClient: LlmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: false,
        error: 'OpenRouter API request failed: timeout',
      }),
    };

    await generateJobKeywordsFromLines({ llmClient });

    const rows = lineKeywordServiceReset.mock.calls[0][0];
    expect(rows).toHaveLength(1);
    expect(rows[0].ai_status).toBe('failed');
    expect(rows[0].ai_is_correct).toBeNull();
    expect(rows[0].final_keyword_groups).toEqual([]);
    expect(rows[0].rule_keywords).toEqual([]);
  });

  it('writes the AI-returned groups to final_keyword_groups and records ai_status "ok"', async () => {
    setupServices([{ id: 'job-1', description: 'React 前端工程師' }]);
    const llmClient: LlmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          groups: [{ category: 'frontend_framework', keywords: ['react'] }],
          reasoning: 'React found',
        },
      }),
    };

    await generateJobKeywordsFromLines({ llmClient });

    const rows = lineKeywordServiceReset.mock.calls[0][0];
    expect(rows[0].ai_status).toBe('ok');
    expect(rows[0].ai_is_correct).toBeNull();
    expect(rows[0].final_keyword_groups).toEqual([{ category: 'frontend_framework', keywords: ['react'] }]);
    expect(rows[0].rule_keywords).toEqual([]);
  });

  it('isolates a single failed line: other lines in the same job and other jobs still process normally', async () => {
    setupServices([
      { id: 'job-fail', description: 'React 前端工程師\nNode.js 後端工程師' },
      { id: 'job-ok', description: 'Python 後端開發工程師' },
    ]);

    const completeStructured = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'timeout' })
      .mockResolvedValueOnce({
        ok: true,
        result: { groups: [], reasoning: 'ok' },
      })
      .mockResolvedValueOnce({
        ok: true,
        result: { groups: [], reasoning: 'ok' },
      });
    const llmClient: LlmClient = { completeStructured };

    await generateJobKeywordsFromLines({ llmClient });

    expect(completeStructured).toHaveBeenCalledTimes(3);

    const lineRows = lineServiceReset.mock.calls[0][0];
    expect(lineRows).toHaveLength(3);

    const reviewRows = lineKeywordServiceReset.mock.calls[0][0];
    expect(reviewRows).toHaveLength(3);

    const failedRow = reviewRows.find((r: any) => r.ai_status === 'failed');
    expect(failedRow).toBeDefined();
    expect(failedRow.final_keyword_groups).toEqual([]);

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
      return { ok: true, result: { groups: [], reasoning: 'ok' } };
    });
    const llmClient: LlmClient = { completeStructured };

    await generateJobKeywordsFromLines({ llmClient, concurrency: 2 });

    expect(completeStructured).toHaveBeenCalledTimes(6);
    expect(peak).toBeLessThanOrEqual(2);
    expect(peak).toBeGreaterThan(1);
  });

  it('aggregates a job\'s multiple lines into one deduped keyword_groups set and upserts it', async () => {
    setupServices([{ id: 'job-1', description: 'React 前端工程師\nReact TypeScript 開發' }]);
    const completeStructured = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        result: {
          groups: [{ category: 'other', keywords: ['react', 'typescript'] }],
          reasoning: 'line 1',
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        result: {
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
    expect(Object.keys(upsertRows[0]).sort()).toEqual(
      ['description_ch_en_ratio', 'id', 'keyword_groups', 'keywords'].sort(),
    );
  });

  it('produces an empty keywords array for a job with no valid lines', async () => {
    setupServices([{ id: 'job-blank', description: '   \n\n   ' }]);

    await generateJobKeywordsFromLines({ llmClient: makeAlwaysOkLlmClient() });

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

    await generateJobKeywordsFromLines({ llmClient: makeAlwaysOkLlmClient() });

    expect(jobKeywordUpsert).toHaveBeenCalledTimes(1);
    const upsertRows = jobKeywordUpsert.mock.calls[0][0];
    expect(upsertRows).toHaveLength(2);
    expect(upsertRows.map((r: any) => r.id).sort()).toEqual(['job-a', 'job-b']);
  });

  it('passes categories (not full keyword map) to the reviewer', async () => {
    setupServices([{ id: 'job-a', description: 'React 前端工程師' }]);
    mvTechFetchAll.mockResolvedValue({
      result: [
        { id: 'tech-1', category: 'frontend_framework', keywords: ['react', 'vue.js'] },
        { id: 'tech-2', category: 'language', keywords: ['typescript'] },
      ],
      count: 2,
      searchParams: '',
    });
    const completeStructured = vi.fn().mockResolvedValue({
      ok: true,
      result: { groups: [], reasoning: 'ok' },
    });

    await generateJobKeywordsFromLines({ llmClient: { completeStructured } });

    const callArg = completeStructured.mock.calls[0][0];
    expect(callArg.input).toMatchObject({
      categories: expect.arrayContaining(['frontend_framework', 'language']),
    });
    // Must NOT contain the full keyword-to-category map.
    expect(callArg.input).not.toHaveProperty('keywordCategoryMap');
  });
});
