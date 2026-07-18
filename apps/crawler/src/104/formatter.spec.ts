import { describe, expect, it } from 'vitest';

import { RequireToCrawlJob } from '../@types';
import { JobDetailOnHTML, JobOnAPI } from './@types';
import { buildPersistItem, cookRawJob } from './formatter';

// Drives task 4.3: `104/formatter.ts` absorbs the "empty description -> closed
// fallback" business decision that used to live in the OLD `apps/crawler/src/
// handler.ts` DETAIL handler (L341-364). `buildPersistItem` is the new
// `CrawlRouterConfig['buildPersistItem']`-shaped callback: it takes the
// detail-crawl item (with `.existingItem`, not `.existingJob`) and the scraped
// detail, returning an `Entry` or `undefined`.
//
// Fixtures below are realistic-shaped `JobOnAPI` responses (matching
// `apps/crawler/src/104/@types.ts`) merged with `RequireToCrawlJob` fields, as
// the real 104 list-page handler produces them prior to enqueueing a DETAIL
// request.

function buildJobOnAPIFixture(
  overrides: Partial<JobOnAPI> = {},
): JobOnAPI {
  return {
    appearDate: '2026/07/01',
    applyCnt: 12,
    coIndustry: 1000,
    coIndustryDesc: '軟體及網路相關業',
    custName: '測試股份有限公司',
    custNo: 'cust-001',
    description: '',
    descSnippet: '',
    mrtDist: 0,
    jobAddress: '台北市信義區',
    jobAddrNo: 1,
    jobAddrNoDesc: '台北市信義區',
    jobName: '資深後端工程師',
    jobNameSnippet: '',
    jobNo: 'job-001',
    jobRo: 0,
    jobType: 1,
    lat: 25.03,
    lon: 121.56,
    link: {
      job: 'https://www.104.com.tw/job/job-001',
      cust: 'https://www.104.com.tw/company/cust-001',
      applyAnalyze: '',
    },
    major: [],
    mrt: '',
    mrtDesc: '',
    optionEdu: [],
    period: 0,
    remoteWorkType: 0,
    s10: 0,
    salaryHigh: 900000,
    salaryLow: 700000,
    tags: {
      wf7: { desc: '', param: '' },
      wf30: { desc: '', param: '' },
      wf29: { desc: '', param: '' },
      wf10: { desc: '', param: '' },
      wf3: { desc: '', param: '' },
      wf1: { desc: '', param: '' },
      wf4: { desc: '', param: '' },
      wf9: { desc: '', param: '' },
      landmark: { desc: '' },
    },
    s9: [],
    s5: 0,
    d3: '',
    hrBehaviorPR: 0,
    jobCat: [],
    labels: [],
    languageRequirements: [],
    acceptRole: [],
    employeeCount: 50,
    pcSkills: [
      { code: '', description: '' },
      { code: '', description: '' },
      { code: '', description: '' },
      { code: '', description: '' },
      { code: '', description: '' },
      { code: '', description: '' },
      { code: '', description: '' },
      { code: '', description: '' },
      { code: '', description: '' },
    ],
    pddScore: 0,
    isSave: null,
    interactionRecord: {
      lastProcessedResumeAtTime: 0,
      lastCustReplyTimestamp: null,
      nowTimestamp: 0,
    },
    isApplied: null,
    applyDate: null,
    userApplyCount: null,
    ...overrides,
  };
}

function buildDetailFixture(
  overrides: Partial<JobDetailOnHTML> = {},
): JobDetailOnHTML {
  return {
    description: '負責後端服務開發與維運',
    salary: '月薪 70,000 元以上',
    location: '台北市信義區',
    ...overrides,
  };
}

function buildRequireToCrawlJobFields(
  overrides: Partial<RequireToCrawlJob> = {},
): RequireToCrawlJob {
  return {
    id: 'job-001',
    title: '資深後端工程師',
    url: 'https://www.104.com.tw/job/job-001',
    existingItem: undefined,
    needToCreate: true,
    ...overrides,
  };
}

// Task 3.1: `ExistingJob` (apps/crawler/src/@types.ts) was widened in task
// 2.2 to carry title/description/location/salary/salary_manual/closed on
// top of id/updated_at/created_at, so `hasJobFieldsChanged` has real fields
// to diff against. Fixture defaults intentionally mirror
// `buildJobOnAPIFixture`/`buildDetailFixture`'s defaults (same title,
// location, description, salary) so a "no override" existingItem represents
// an unchanged job.
function buildExistingItemFixture(
  overrides: Partial<NonNullable<RequireToCrawlJob['existingItem']>> = {},
): NonNullable<RequireToCrawlJob['existingItem']> {
  return {
    id: 'job-001',
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    created_at: new Date('2025-01-01T00:00:00.000Z'),
    title: '資深後端工程師',
    description: '負責後端服務開發與維運',
    location: '台北市信義區',
    salary: '月薪 70,000 元以上',
    salary_manual: false,
    closed: false,
    ...overrides,
  };
}

describe('cookRawJob (pure transform, pre-migration behavior preserved)', () => {
  it('produces the same Entry shape as before for a normal (non-empty description) job', () => {
    const job = {
      ...buildJobOnAPIFixture(),
      ...buildRequireToCrawlJobFields(),
    };
    const detail = buildDetailFixture();

    const entry = cookRawJob(job, detail, ['後端', 'Node.js']);

    expect(entry.job).toMatchObject({
      id: 'job-001',
      title: '資深後端工程師',
      detail_link: 'https://www.104.com.tw/job/job-001',
      location: '台北市信義區',
      description: '負責後端服務開發與維運',
      company_id: 'cust-001',
      closed: false,
    });
    expect(entry.company).toMatchObject({
      id: 'cust-001',
      name: '測試股份有限公司',
      link: 'https://www.104.com.tw/company/cust-001',
      type: '軟體及網路相關業',
    });
    expect(entry.jobKeyword.id).toBe('job-001');
  });
});

// Task 3.1: `crawled_at`/`updated_at` split per design.md §6.3 一般爬取路徑.
// `crawled_at` always advances to "now" on every re-process; `updated_at`
// only advances when `hasJobFieldsChanged` detects a real content diff
// against `existingItem` (with the `salary_manual` exemption honored).
describe('cookRawJob crawled_at / updated_at split (task 3.1)', () => {
  it('new job (needToCreate: true): sets both crawled_at and updated_at to now', () => {
    const job = {
      ...buildJobOnAPIFixture(),
      ...buildRequireToCrawlJobFields({
        needToCreate: true,
        existingItem: undefined,
      }),
    };
    const detail = buildDetailFixture();

    const before = Date.now();
    const entry = cookRawJob(job, detail);
    const after = Date.now();

    expect(entry.job.crawled_at).toBeInstanceOf(Date);
    expect(entry.job.updated_at).toBeInstanceOf(Date);
    const crawledAtTime = (entry.job.crawled_at as unknown as Date).getTime();
    const updatedAtTime = (entry.job.updated_at as unknown as Date).getTime();
    expect(crawledAtTime).toBeGreaterThanOrEqual(before);
    expect(crawledAtTime).toBeLessThanOrEqual(after);
    expect(updatedAtTime).toBeGreaterThanOrEqual(before);
    expect(updatedAtTime).toBeLessThanOrEqual(after);
  });

  it('existing job, no field changed: crawled_at updates to now, updated_at stays as existingItem.updated_at', () => {
    const existingItem = buildExistingItemFixture();
    const job = {
      ...buildJobOnAPIFixture(),
      ...buildRequireToCrawlJobFields({
        needToCreate: false,
        existingItem,
      }),
    };
    // Matches existingItem's title/location/description/salary exactly.
    const detail = buildDetailFixture();

    const before = Date.now();
    const entry = cookRawJob(job, detail);
    const after = Date.now();

    const crawledAtTime = (entry.job.crawled_at as unknown as Date).getTime();
    expect(crawledAtTime).toBeGreaterThanOrEqual(before);
    expect(crawledAtTime).toBeLessThanOrEqual(after);
    expect(entry.job.updated_at).toEqual(existingItem.updated_at);
  });

  it('existing job, some field changed (description): both crawled_at and updated_at update to now', () => {
    const existingItem = buildExistingItemFixture();
    const job = {
      ...buildJobOnAPIFixture(),
      ...buildRequireToCrawlJobFields({
        needToCreate: false,
        existingItem,
      }),
    };
    const detail = buildDetailFixture({ description: '全新的職缺描述內容' });

    const before = Date.now();
    const entry = cookRawJob(job, detail);
    const after = Date.now();

    const crawledAtTime = (entry.job.crawled_at as unknown as Date).getTime();
    const updatedAtTime = (entry.job.updated_at as unknown as Date).getTime();
    expect(crawledAtTime).toBeGreaterThanOrEqual(before);
    expect(crawledAtTime).toBeLessThanOrEqual(after);
    expect(updatedAtTime).toBeGreaterThanOrEqual(before);
    expect(updatedAtTime).toBeLessThanOrEqual(after);
  });

  it('existing job with salary_manual: true and only salary differs: updated_at does NOT update (salary comparison excluded)', () => {
    const existingItem = buildExistingItemFixture({
      salary_manual: true,
      salary: '面議（人工調整）',
    });
    const job = {
      ...buildJobOnAPIFixture(),
      ...buildRequireToCrawlJobFields({
        needToCreate: false,
        existingItem,
      }),
    };
    // Only salary differs from existingItem; title/location/description match.
    const detail = buildDetailFixture({ salary: '月薪 90,000 元以上' });

    const entry = cookRawJob(job, detail);

    // The Entry's own `salary` field is still freshly written (salary_manual
    // only exempts the *comparison*, not the write).
    expect(entry.job.salary).toBe('月薪 90,000 元以上');
    expect(entry.job.updated_at).toEqual(existingItem.updated_at);
  });
});

describe('buildPersistItem (new CrawlRouterConfig.buildPersistItem callback, task 4.3)', () => {
  it('(a) normal case: non-empty detail.description produces the same Entry as cookRawJob would (job not closed)', () => {
    const item = {
      ...buildJobOnAPIFixture(),
      ...buildRequireToCrawlJobFields({ needToCreate: true, existingItem: undefined }),
    };
    const detail = buildDetailFixture({ description: '負責後端服務開發與維運' });

    const result = buildPersistItem(['後端'])(item, detail);

    expect(result).toBeDefined();
    expect(result?.job.description).toBe('負責後端服務開發與維運');
    expect(result?.job.closed).toBe(false);
    expect(result?.job.id).toBe('job-001');
    // Normal case always carries company/jobKeyword (only the closed-fallback
    // case omits them); assert presence before narrowing.
    expect(result?.company).toBeDefined();
    expect(result?.jobKeyword).toBeDefined();
    expect(result?.company?.id).toBe('cust-001');
    expect(result?.jobKeyword?.id).toBe('job-001');
  });

  it('(b) empty-description + existing item: produces a closed-job update equivalent to the original {...existingJob, updated_at, closed:true} fallback', () => {
    const existingItem = buildExistingItemFixture({ closed: false });
    const item = {
      ...buildJobOnAPIFixture(),
      ...buildRequireToCrawlJobFields({
        needToCreate: false,
        existingItem,
      }),
    };
    const detail = buildDetailFixture({ description: '' });

    const before = Date.now();
    const result = buildPersistItem([])(item, detail);
    const after = Date.now();

    expect(result).toBeDefined();
    expect(result?.job.id).toBe('job-001');
    expect(result?.job.closed).toBe(true);
    expect(result?.job.created_at).toEqual(existingItem.created_at);
    // updated_at must be a freshly-generated "now" timestamp (matching original
    // `updated_at: new Date()`), not the stale existingItem.updated_at.
    expect(result?.job.updated_at).toBeInstanceOf(Date);
    const updatedAtTime = (result?.job.updated_at as Date).getTime();
    expect(updatedAtTime).toBeGreaterThanOrEqual(before);
    expect(updatedAtTime).toBeLessThanOrEqual(after);
    // Only the closed-fallback update fields are asserted; per the
    // ExistingJobMeta/existingItem shape, no other Job columns are available
    // (and PostgREST upsert merge-duplicates semantics mean omitted columns
    // are left untouched at the DB level, so this is behaviorally equivalent).
    // Matches the OLD handler's closed-fallback branch, which only ever
    // pushed to `pendingJobs` (never `pendingCompanies`/`pendingJobKeywords`)
    // for this case.
    expect(result?.company).toBeUndefined();
    expect(result?.jobKeyword).toBeUndefined();
  });

  it('(c) empty-description + no existing item: returns undefined (nothing to persist, matching original behavior of doing nothing)', () => {
    const item = {
      ...buildJobOnAPIFixture(),
      ...buildRequireToCrawlJobFields({
        needToCreate: true,
        existingItem: undefined,
      }),
    };
    const detail = buildDetailFixture({ description: '' });

    const result = buildPersistItem([])(item, detail);

    expect(result).toBeUndefined();
  });

  // Task 6.2 addition: proves field-value AND count consistency across a
  // realistic multi-item batch (mirrors what a single 104 list page's worth
  // of DETAIL results would look like: a mix of normal, closed-fallback, and
  // skip cases). The OLD `handler.ts` DETAIL handler processed each job's
  // `cookRawJob` result one request at a time and pushed onto module-level
  // `pendingJobs`/`pendingCompanies`/`pendingJobKeywords` arrays (skipping
  // the "no existing item" case entirely); this test proves the NEW
  // per-item `buildPersistItem` callback, when mapped over a batch and
  // filtered for `undefined`, reproduces that exact per-item field-value
  // and array-length (筆數) behavior without cross-item interference.
  it('(d) batch of 3 distinct jobs (normal, closed-fallback, skip) preserves per-item field values and yields the correct persisted count', () => {
    const jobA = {
      ...buildJobOnAPIFixture({
        jobNo: 'job-A',
        jobName: '前端工程師',
        custName: 'A 公司',
        custNo: 'cust-A',
        link: {
          job: 'https://www.104.com.tw/job/job-A',
          cust: 'https://www.104.com.tw/company/cust-A',
          applyAnalyze: '',
        },
      }),
      ...buildRequireToCrawlJobFields({
        id: 'job-A',
        title: '前端工程師',
        url: 'https://www.104.com.tw/job/job-A',
        needToCreate: true,
        existingItem: undefined,
      }),
    };
    const detailA = buildDetailFixture({
      description: '負責前端介面開發',
    });

    const existingItemB = buildExistingItemFixture({
      id: 'job-B',
      updated_at: new Date('2026-02-01T00:00:00.000Z'),
      created_at: new Date('2025-02-01T00:00:00.000Z'),
      closed: false,
    });
    const jobB = {
      ...buildJobOnAPIFixture({
        jobNo: 'job-B',
        jobName: '資料工程師',
        custName: 'B 公司',
        custNo: 'cust-B',
        link: {
          job: 'https://www.104.com.tw/job/job-B',
          cust: 'https://www.104.com.tw/company/cust-B',
          applyAnalyze: '',
        },
      }),
      ...buildRequireToCrawlJobFields({
        id: 'job-B',
        title: '資料工程師',
        url: 'https://www.104.com.tw/job/job-B',
        needToCreate: false,
        existingItem: existingItemB,
      }),
    };
    const detailB = buildDetailFixture({ description: '' });

    const jobC = {
      ...buildJobOnAPIFixture({
        jobNo: 'job-C',
        jobName: 'QA 工程師',
        custName: 'C 公司',
        custNo: 'cust-C',
        link: {
          job: 'https://www.104.com.tw/job/job-C',
          cust: 'https://www.104.com.tw/company/cust-C',
          applyAnalyze: '',
        },
      }),
      ...buildRequireToCrawlJobFields({
        id: 'job-C',
        title: 'QA 工程師',
        url: 'https://www.104.com.tw/job/job-C',
        needToCreate: true,
        existingItem: undefined,
      }),
    };
    const detailC = buildDetailFixture({ description: '' });

    const build = buildPersistItem(['前端']);
    const results = [
      build(jobA, detailA),
      build(jobB, detailB),
      build(jobC, detailC),
    ].filter((r): r is NonNullable<typeof r> => r !== undefined);

    // Count: 3 inputs -> 2 persisted items (jobC's skip case correctly
    // drops out, matching the OLD handler never pushing anything for it).
    expect(results).toHaveLength(2);

    const [resultA, resultB] = results;
    expect(resultA.job.id).toBe('job-A');
    expect(resultA.job.description).toBe('負責前端介面開發');
    expect(resultA.job.closed).toBe(false);
    expect(resultA.company?.id).toBe('cust-A');
    expect(resultA.company?.name).toBe('A 公司');
    expect(resultA.jobKeyword?.id).toBe('job-A');

    expect(resultB.job.id).toBe('job-B');
    expect(resultB.job.closed).toBe(true);
    expect(resultB.job.created_at).toEqual(existingItemB.created_at);
    expect(resultB.company).toBeUndefined();
    expect(resultB.jobKeyword).toBeUndefined();

    // Cross-item isolation: job-A's fields must not leak into job-B's result.
    expect(resultB.job.id).not.toBe(resultA.job.id);
  });

  // Task 3.1: closed-fallback branch crawled_at/updated_at split per
  // design.md §6.3 一般爬取路徑 closed-fallback 分支.
  it('(e) closed-fallback, job was NOT already closed: crawled_at updates and updated_at updates too (real transition)', () => {
    const existingItem = buildExistingItemFixture({ closed: false });
    const item = {
      ...buildJobOnAPIFixture(),
      ...buildRequireToCrawlJobFields({
        needToCreate: false,
        existingItem,
      }),
    };
    const detail = buildDetailFixture({ description: '' });

    const before = Date.now();
    const result = buildPersistItem([])(item, detail);
    const after = Date.now();

    expect(result?.job.closed).toBe(true);
    const crawledAtTime = (
      result?.job.crawled_at as unknown as Date
    ).getTime();
    const updatedAtTime = (
      result?.job.updated_at as unknown as Date
    ).getTime();
    expect(crawledAtTime).toBeGreaterThanOrEqual(before);
    expect(crawledAtTime).toBeLessThanOrEqual(after);
    expect(updatedAtTime).toBeGreaterThanOrEqual(before);
    expect(updatedAtTime).toBeLessThanOrEqual(after);
  });

  it('(f) closed-fallback, job WAS already closed: crawled_at updates, updated_at stays unchanged', () => {
    const existingItem = buildExistingItemFixture({ closed: true });
    const item = {
      ...buildJobOnAPIFixture(),
      ...buildRequireToCrawlJobFields({
        needToCreate: false,
        existingItem,
      }),
    };
    const detail = buildDetailFixture({ description: '' });

    const before = Date.now();
    const result = buildPersistItem([])(item, detail);
    const after = Date.now();

    expect(result?.job.closed).toBe(true);
    const crawledAtTime = (
      result?.job.crawled_at as unknown as Date
    ).getTime();
    expect(crawledAtTime).toBeGreaterThanOrEqual(before);
    expect(crawledAtTime).toBeLessThanOrEqual(after);
    expect(result?.job.updated_at).toEqual(existingItem.updated_at);
  });
});
