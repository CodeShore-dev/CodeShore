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
    const existingItem = {
      id: 'senior-backend-engineer',
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
      created_at: new Date('2025-01-01T00:00:00.000Z'),
    };
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
});
