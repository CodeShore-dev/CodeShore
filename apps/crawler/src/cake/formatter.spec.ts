import { describe, expect, it } from 'vitest';

import { RequireToCrawlJob } from '../@types';
import { JobDetailOnHTML, JobOnAPI } from './@types';
import { buildPersistItem, cookRawJob } from './formatter';

// Drives task 4.4: `cake/formatter.ts` absorbs the "empty description ->
// closed fallback" business decision that used to live in the OLD
// `apps/crawler/src/handler.ts` DETAIL handler (L341-364), shared generically
// between 104 and Cake. `buildPersistItem` is the new
// `CrawlRouterConfig['buildPersistItem']`-shaped callback: it takes the
// detail-crawl item (with `.existingItem`, not `.existingJob`) and the scraped
// detail, returning an `Entry` (well, `PersistItem`) or `undefined`.
//
// Fixtures below are realistic-shaped `JobOnAPI` responses (matching
// `apps/crawler/src/cake/@types.ts`) merged with `RequireToCrawlJob` fields,
// as the real Cake list-page handler produces them prior to enqueueing a
// DETAIL request. Note Cake's `id` comes directly from `path` (no
// `getIdFromUrl` needed, unlike 104).

function buildJobOnAPIFixture(
  overrides: Partial<JobOnAPI> = {},
): JobOnAPI {
  return {
    path: 'senior-backend-engineer',
    title: '資深後端工程師',
    highlighted_title: '資深後端工程師',
    description: '',
    highlighted_description: '',
    locations: ['台北市信義區'],
    locations_with_locale: [],
    salary: {
      min: '700000',
      max: '900000',
      currency: 'TWD',
      type: 'yearly',
    },
    seniority_level: 'Senior',
    job_type: 'Full-time',
    inclusivity_traits: [],
    number_of_management: '0',
    number_of_openings: 1,
    tags: ['後端', 'Node.js'],
    page: {
      path: 'cust-001',
      name: '測試股份有限公司',
      highlighted_name: '測試股份有限公司',
      logo: '',
      country: 'Taiwan',
      geo: {
        region_l: '台北市信義區',
        city: '台北市',
        state_name: '',
        zip: '',
        street_address: '',
      },
    },
    unique_impressions_count: 0,
    lang_name: 'zh-TW',
    min_work_exp_year: 3,
    content_updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function buildDetailFixture(
  overrides: Partial<JobDetailOnHTML> = {},
): JobDetailOnHTML {
  return {
    description: '負責後端服務開發與維運',
    salary: '月薪 70,000 元以上',
    company_type: '軟體及網路相關業',
    location: '台北市信義區',
    ...overrides,
  };
}

function buildRequireToCrawlJobFields(
  overrides: Partial<RequireToCrawlJob> = {},
): RequireToCrawlJob {
  return {
    id: 'senior-backend-engineer',
    title: '資深後端工程師',
    url: 'https://www.cake.me/companies/cust-001/jobs/senior-backend-engineer',
    existingItem: undefined,
    needToCreate: true,
    ...overrides,
  };
}

// Task 3.2: `ExistingJob` (apps/crawler/src/@types.ts) was widened in task
// 2.2 to carry title/description/location/salary/salary_manual/closed on
// top of id/updated_at/created_at, so `hasJobFieldsChanged` has real fields
// to diff against. Fixture defaults intentionally mirror
// `buildJobOnAPIFixture`/`buildDetailFixture`'s defaults (same title,
// location, description-with-tags, salary) so a "no override" existingItem
// represents an unchanged job.
function buildExistingItemFixture(
  overrides: Partial<NonNullable<RequireToCrawlJob['existingItem']>> = {},
): NonNullable<RequireToCrawlJob['existingItem']> {
  return {
    id: 'senior-backend-engineer',
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    created_at: new Date('2025-01-01T00:00:00.000Z'),
    title: '資深後端工程師',
    description: '負責後端服務開發與維運\nTags: 後端, Node.js',
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
      id: 'senior-backend-engineer',
      title: '資深後端工程師',
      detail_link:
        'https://www.cake.me/companies/cust-001/jobs/senior-backend-engineer',
      location: '台北市信義區',
      description: '負責後端服務開發與維運\nTags: 後端, Node.js',
      company_id: 'cust-001',
      closed: false,
    });
    expect(entry.company).toMatchObject({
      id: 'cust-001',
      name: '測試股份有限公司',
      link: 'https://www.cake.me/companies/cust-001',
      type: '軟體及網路相關業',
    });
    expect(entry.jobKeyword.id).toBe('senior-backend-engineer');
  });
});

// Task 3.2: `crawled_at`/`updated_at` split per design.md §6.3 一般爬取路徑.
// `crawled_at` always advances to "now" on every re-process; `updated_at`
// only advances when `hasJobFieldsChanged` detects a real content diff
// against `existingItem` (with the `salary_manual` exemption honored).
describe('cookRawJob crawled_at / updated_at split (task 3.2)', () => {
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
    // Matches existingItem's title/location/description(+tags)/salary exactly.
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

describe('buildPersistItem (new CrawlRouterConfig.buildPersistItem callback, task 4.4)', () => {
  it('(a) normal case: non-empty detail.description produces the same Entry as cookRawJob would (job not closed)', () => {
    const item = {
      ...buildJobOnAPIFixture(),
      ...buildRequireToCrawlJobFields({
        needToCreate: true,
        existingItem: undefined,
      }),
    };
    const detail = buildDetailFixture({
      description: '負責後端服務開發與維運',
    });

    const result = buildPersistItem(['後端'])(item, detail);

    expect(result).toBeDefined();
    expect(result?.job.description).toBe(
      '負責後端服務開發與維運\nTags: 後端, Node.js',
    );
    expect(result?.job.closed).toBe(false);
    expect(result?.job.id).toBe('senior-backend-engineer');
    // Normal case always carries company/jobKeyword (only the closed-fallback
    // case omits them); assert presence before narrowing.
    expect(result?.company).toBeDefined();
    expect(result?.jobKeyword).toBeDefined();
    expect(result?.company?.id).toBe('cust-001');
    expect(result?.jobKeyword?.id).toBe('senior-backend-engineer');
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
    expect(result?.job.id).toBe('senior-backend-engineer');
    expect(result?.job.closed).toBe(true);
    expect(result?.job.created_at).toEqual(existingItem.created_at);
    // updated_at must be a freshly-generated "now" timestamp (matching
    // original `updated_at: new Date()`), not the stale
    // existingItem.updated_at.
    expect(result?.job.updated_at).toBeInstanceOf(Date);
    const updatedAtTime = (result?.job.updated_at as Date).getTime();
    expect(updatedAtTime).toBeGreaterThanOrEqual(before);
    expect(updatedAtTime).toBeLessThanOrEqual(after);
    // Only the closed-fallback update fields are asserted; per the
    // ExistingJobMeta/existingItem shape, no other Job columns are available
    // (and PostgREST upsert merge-duplicates semantics mean omitted columns
    // are left untouched at the DB level, so this is behaviorally
    // equivalent). Matches the OLD handler's closed-fallback branch, which
    // only ever pushed to `pendingJobs` (never
    // `pendingCompanies`/`pendingJobKeywords`) for this case.
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
  // realistic multi-item batch (mirrors what a single Cake list page's worth
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
        path: 'frontend-engineer',
        title: '前端工程師',
        tags: ['前端'],
        page: {
          path: 'cust-A',
          name: 'A 公司',
          highlighted_name: 'A 公司',
          logo: '',
          country: 'Taiwan',
          geo: {
            region_l: '台北市大安區',
            city: '台北市',
            state_name: '',
            zip: '',
            street_address: '',
          },
        },
      }),
      ...buildRequireToCrawlJobFields({
        id: 'frontend-engineer',
        title: '前端工程師',
        url: 'https://www.cake.me/companies/cust-A/jobs/frontend-engineer',
        needToCreate: true,
        existingItem: undefined,
      }),
    };
    const detailA = buildDetailFixture({
      description: '負責前端介面開發',
      company_type: '軟體及網路相關業',
    });

    const existingItemB = buildExistingItemFixture({
      id: 'data-engineer',
      updated_at: new Date('2026-02-01T00:00:00.000Z'),
      created_at: new Date('2025-02-01T00:00:00.000Z'),
      closed: false,
    });
    const jobB = {
      ...buildJobOnAPIFixture({
        path: 'data-engineer',
        title: '資料工程師',
        tags: [],
        page: {
          path: 'cust-B',
          name: 'B 公司',
          highlighted_name: 'B 公司',
          logo: '',
          country: 'Taiwan',
          geo: {
            region_l: '新北市板橋區',
            city: '新北市',
            state_name: '',
            zip: '',
            street_address: '',
          },
        },
      }),
      ...buildRequireToCrawlJobFields({
        id: 'data-engineer',
        title: '資料工程師',
        url: 'https://www.cake.me/companies/cust-B/jobs/data-engineer',
        needToCreate: false,
        existingItem: existingItemB,
      }),
    };
    const detailB = buildDetailFixture({ description: '' });

    const jobC = {
      ...buildJobOnAPIFixture({
        path: 'qa-engineer',
        title: 'QA 工程師',
        tags: [],
        page: {
          path: 'cust-C',
          name: 'C 公司',
          highlighted_name: 'C 公司',
          logo: '',
          country: 'Taiwan',
          geo: {
            region_l: '台中市西屯區',
            city: '台中市',
            state_name: '',
            zip: '',
            street_address: '',
          },
        },
      }),
      ...buildRequireToCrawlJobFields({
        id: 'qa-engineer',
        title: 'QA 工程師',
        url: 'https://www.cake.me/companies/cust-C/jobs/qa-engineer',
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
    expect(resultA.job.id).toBe('frontend-engineer');
    expect(resultA.job.description).toBe(
      '負責前端介面開發\nTags: 前端',
    );
    expect(resultA.job.closed).toBe(false);
    expect(resultA.company?.id).toBe('cust-A');
    expect(resultA.company?.name).toBe('A 公司');
    expect(resultA.jobKeyword?.id).toBe('frontend-engineer');

    expect(resultB.job.id).toBe('data-engineer');
    expect(resultB.job.closed).toBe(true);
    expect(resultB.job.created_at).toEqual(existingItemB.created_at);
    expect(resultB.company).toBeUndefined();
    expect(resultB.jobKeyword).toBeUndefined();

    // Cross-item isolation: job-A's fields must not leak into job-B's result.
    expect(resultB.job.id).not.toBe(resultA.job.id);
  });

  // Task 3.2: closed-fallback branch crawled_at/updated_at split per
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
