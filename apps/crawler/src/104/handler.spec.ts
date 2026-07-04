import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CrawlRouterConfig } from '@codeshore/crawler-core';

import { JobDetailOnHTML, JobOnAPI, JobsAPIResponse } from './@types';
import { PersistItem } from '../persistence';
import { ExistingJob, RequireToCrawlJob } from '../@types';

// Task 5.2: `104/handler.ts` was switched from calling `createCrawlRouter`
// directly to calling `@codeshore/sync-core`'s `createSyncRouter`, which
// internally adapts `syncRepository`/`sourceRegistry` (from
// `apps/crawler/src/persistence.ts`) into `resolveExisting`/`onBatchReady`/
// `onListPageResolved` before delegating to `createCrawlRouter`. This is a
// REGRESSION requirement (requirements 6.1, 6.2): the persisted item content
// and every other config field driving the crawl (matchListResponse,
// parsePagination, extractItems, transformItem, detailPageWaitSelector,
// extractDetailOnHTML, buildPersistItem, resolveBatchSize) must behave
// identically to the pre-migration direct `createCrawlRouter` call.
//
// `createSyncRouter`'s own translation logic (resolveExisting/onBatchReady/
// onListPageResolved wiring) is already exhaustively covered in
// `libs/sync-core/src/sync/create-sync-router.spec.ts`, and `persistence.ts`'s
// `syncRepository`/`sourceRegistry` implementations are covered in
// `apps/crawler/src/persistence.spec.ts`. This spec's job is narrower: prove
// that `104/handler.ts`'s `createHandler` (a) wires the REAL `syncRepository`/
// `sourceRegistry` singletons from `persistence.ts` into `createSyncRouter`
// (not ad-hoc stand-ins), and (b) that the resulting `CrawlRouterConfig`
// fields, driven with realistic 104 API-response/detail-page fixtures,
// produce output identical to what the pre-migration direct-`createCrawlRouter`
// wiring produced.
const { createCrawlRouterMock } = vi.hoisted(() => ({
  createCrawlRouterMock: vi.fn(),
}));

// Avoid `importOriginal()` here: it forces a real load of the full
// `@codeshore/crawler-core` barrel (crawlee/puppeteer/stealth-plugin chain),
// which takes ~9s and blows past vitest's default 5000ms test timeout.
// `handler.ts` only needs `getIdFromUrl` (a pure function) at runtime from
// this package, so it's reimplemented inline rather than really imported.
vi.mock('@codeshore/crawler-core', () => ({
  createCrawlRouter: createCrawlRouterMock,
  getIdFromUrl: (url: string) =>
    new URL(url).pathname.split('/').filter(Boolean).slice(-1)[0],
}));

// `persistence.ts` constructs `JobService`/`CompanyService`/`JobKeywordService`/
// `JobSourceService`/`JobSourceURLService` from `@codeshore/data-utils`, which
// build a real Supabase client under the hood. Mock the module the same way
// `apps/crawler/src/persistence.spec.ts` does so importing the real
// `syncRepository`/`sourceRegistry` singletons never touches Supabase.
const {
  upsertMock,
  fetchAllMock,
  jobSourceUrlFetchAllMock,
  jobSourceUrlClearAllMock,
  jobSourceFetchAllMock,
  upsertJobSourceURLMock,
  createJobSourceURLsMock,
} = vi.hoisted(() => {
  const upsertMockInner = vi.fn(async () => undefined);
  const fetchAllMockInner = vi.fn(async () => ({
    result: [] as { id: string; updated_at: string; created_at: string }[],
    count: 0,
    searchParams: '',
  }));
  const jobSourceUrlFetchAllMockInner = vi.fn(async () => ({
    result: [] as { url: string; page_index: number; status: string }[],
    count: 0,
    searchParams: '',
  }));
  const jobSourceFetchAllMockInner = vi.fn(async () => ({
    result: [] as { url: string }[],
    count: 0,
    searchParams: '',
  }));
  return {
    upsertMock: upsertMockInner,
    fetchAllMock: fetchAllMockInner,
    jobSourceUrlFetchAllMock: jobSourceUrlFetchAllMockInner,
    jobSourceUrlClearAllMock: vi.fn(async () => undefined),
    jobSourceFetchAllMock: jobSourceFetchAllMockInner,
    upsertJobSourceURLMock: vi.fn(async () => undefined),
    createJobSourceURLsMock: vi.fn(async () => undefined),
  };
});

vi.mock('@codeshore/data-utils', () => ({
  JobService: vi.fn(() => ({
    upsert: upsertMock,
    fetchAll: fetchAllMock,
  })),
  CompanyService: vi.fn(() => ({ upsert: upsertMock })),
  JobKeywordService: vi.fn(() => ({ upsert: upsertMock })),
  JobSourceService: vi.fn(() => ({ fetchAll: jobSourceFetchAllMock })),
  JobSourceURLService: vi.fn(() => ({
    fetchAll: jobSourceUrlFetchAllMock,
    clearAll: jobSourceUrlClearAllMock,
  })),
  upsertJobSourceURL: upsertJobSourceURLMock,
  createJobSourceURLs: createJobSourceURLsMock,
}));

const FAKE_CRAWL_ROUTER_RESULT = {
  router: {} as never,
  flushPending: vi.fn().mockResolvedValue(undefined),
};

function buildJobOnAPIFixture(overrides: Partial<JobOnAPI> = {}): JobOnAPI {
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

function buildJobsAPIResponseFixture(
  overrides: {
    data?: JobOnAPI[];
    currentPage?: number;
    lastPage?: number;
    total?: number;
    count?: number;
  } = {},
): JobsAPIResponse {
  const data = overrides.data ?? [buildJobOnAPIFixture()];
  return {
    data,
    metadata: {
      pagination: {
        count: overrides.count ?? data.length,
        currentPage: overrides.currentPage ?? 1,
        lastPage: overrides.lastPage ?? 3,
        total: overrides.total ?? 42,
      },
      isPreciseHotJob: false,
      filterQuery: {
        order: 0,
        asc: 0,
        excludeKwFz: 0,
        excludeKwKwop: 0,
        s5: 0,
        searchTempExclude: 0,
        enableJobNoTopOrder: 0,
        area: [],
        wktm: [],
        s9: [],
        jobcat: [],
        ro: [],
        scstrict: 0,
        scneg: 0,
        page: 1,
        pagesize: 20,
      },
      personalBoost: 0,
    },
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

describe('104/handler.ts createHandler (post sync-core migration)', () => {
  // `./handler` transitively imports `@codeshore/sync-core`, whose barrel
  // unconditionally re-exports the staleness engine (which imports real
  // `crawlee`/`puppeteer`). That first real module load costs ~9s, which
  // blows past vitest's default 5000ms per-test timeout if paid lazily by
  // whichever test happens to import './handler' first. Pre-warm it here
  // with a generous allowance so every test below hits an already-cached
  // module and finishes fast.
  beforeAll(async () => {
    await import('./handler');
  }, 15000);

  beforeEach(() => {
    vi.clearAllMocks();
    createCrawlRouterMock.mockReturnValue(FAKE_CRAWL_ROUTER_RESULT);
  });

  async function loadPassedConfig(allGroupKeywords: string[] = []) {
    const { createHandler } = await import('./handler');
    createHandler(allGroupKeywords);

    expect(createCrawlRouterMock).toHaveBeenCalledTimes(1);
    return createCrawlRouterMock.mock.calls[0][0] as CrawlRouterConfig<
      JobsAPIResponse,
      JobOnAPI & { id: string },
      JobDetailOnHTML,
      PersistItem,
      ExistingJob
    >;
  }

  it('wires the real syncRepository/sourceRegistry singletons from persistence.ts through createSyncRouter into resolveExisting/onBatchReady', async () => {
    fetchAllMock.mockResolvedValueOnce({
      result: [
        {
          id: 'job-existing',
          updated_at: '2026-01-01T00:00:00.000Z',
          created_at: '2025-01-01T00:00:00.000Z',
        },
      ],
      count: 1,
      searchParams: '',
    });

    const passedConfig = await loadPassedConfig();

    // resolveExisting must delegate to the real syncRepository.fetchExisting,
    // reproducing the pre-migration resolveExisting's Supabase query shape.
    const existingMap = await passedConfig.resolveExisting();
    expect(fetchAllMock).toHaveBeenCalledWith({
      select: 'id, updated_at, created_at',
    });
    expect(existingMap.get('job-existing')).toEqual({
      id: 'job-existing',
      updated_at: '2026-01-01T00:00:00.000Z',
      created_at: '2025-01-01T00:00:00.000Z',
    });

    // onBatchReady must delegate to the real syncRepository.upsertEntities,
    // reproducing the pre-migration onBatchReady's dispatch to
    // CompanyService/JobService/JobKeywordService.
    const job = { id: 'job-001', title: 'x' } as never;
    const company = { id: 'cust-001', name: 'y' } as never;
    const jobKeyword = { id: 'job-001', keywords: [] } as never;
    await passedConfig.onBatchReady([{ job, company, jobKeyword }]);
    expect(upsertMock).toHaveBeenCalledWith([company]);
    expect(upsertMock).toHaveBeenCalledWith([job]);
    expect(upsertMock).toHaveBeenCalledWith([jobKeyword]);
  });

  it('onListPageResolved registers remaining pages and marks status via the real sourceRegistry, matching pre-migration onListPageResolved behavior', async () => {
    const passedConfig = await loadPassedConfig();

    await passedConfig.onListPageResolved({
      url: 'https://www.104.com.tw/jobs/search/api/jobs?page=1',
      page: 1,
      totalPages: 3,
      status: 'completed',
    });

    expect(createJobSourceURLsMock).toHaveBeenCalledWith(
      'https://www.104.com.tw/jobs/search/api/jobs?page=1',
      3,
    );
    expect(upsertJobSourceURLMock).toHaveBeenCalledWith(
      'https://www.104.com.tw/jobs/search/api/jobs?page=1',
      1,
      'completed',
    );
  });

  it('matchListResponse identifies the 104 list API URL exactly as before', async () => {
    const passedConfig = await loadPassedConfig();

    expect(
      passedConfig.matchListResponse(
        'https://www.104.com.tw/jobs/search/api/jobs?page=1',
      ),
    ).toBe(true);
    expect(
      passedConfig.matchListResponse('https://www.104.com.tw/job/job-001'),
    ).toBe(false);
  });

  it('parsePagination/extractItems/resolveBatchSize extract the same fields from a realistic 104 API response fixture as before', async () => {
    const passedConfig = await loadPassedConfig();
    const response = buildJobsAPIResponseFixture({
      data: [
        buildJobOnAPIFixture({ jobNo: 'job-001' }),
        buildJobOnAPIFixture({
          jobNo: 'job-002',
          jobName: '前端工程師',
          link: {
            job: 'https://www.104.com.tw/job/job-002',
            cust: 'https://www.104.com.tw/company/cust-001',
            applyAnalyze: '',
          },
        }),
      ],
      currentPage: 2,
      lastPage: 5,
      total: 88,
      count: 2,
    });

    expect(passedConfig.parsePagination(response)).toEqual({
      currentPage: 2,
      totalPages: 5,
      totalEntries: 88,
    });

    const items = passedConfig.extractItems(response);
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe('job-001');
    expect(items[1].id).toBe('job-002');

    expect(passedConfig.resolveBatchSize?.(response)).toBe(2);
  });

  it('transformItem maps url/title from the raw 104 item exactly as before', async () => {
    const passedConfig = await loadPassedConfig();
    const rawItem = {
      ...buildJobOnAPIFixture(),
      id: 'job-001',
      title: '',
      url: '',
      existingItem: undefined,
      needToCreate: true,
    };

    const transformed = passedConfig.transformItem?.(rawItem as never);

    expect(transformed).toMatchObject({
      url: 'https://www.104.com.tw/job/job-001',
      title: '資深後端工程師',
    });
  });

  it('detailPageWaitSelector/extractDetailOnHTML are passed through unchanged from 104/utils.ts', async () => {
    const passedConfig = await loadPassedConfig();
    expect(passedConfig.detailPageWaitSelector).toBe(
      '.job-description__content',
    );
    expect(typeof passedConfig.extractDetailOnHTML).toBe('function');
  });

  it('buildPersistItem, driven with API-response + detail-page fixtures, produces identical persisted item content to pre-migration behavior (normal case)', async () => {
    const allGroupKeywords = ['後端', 'Node.js'];
    const passedConfig = await loadPassedConfig(allGroupKeywords);

    const item: JobOnAPI & RequireToCrawlJob = {
      ...buildJobOnAPIFixture(),
      id: 'job-001',
      title: '資深後端工程師',
      url: 'https://www.104.com.tw/job/job-001',
      existingItem: undefined,
      needToCreate: true,
    };
    const detail = buildDetailFixture();

    const result = passedConfig.buildPersistItem(item, detail);

    expect(result).toBeDefined();
    expect(result?.job).toMatchObject({
      id: 'job-001',
      title: '資深後端工程師',
      detail_link: 'https://www.104.com.tw/job/job-001',
      location: '台北市信義區',
      description: '負責後端服務開發與維運',
      company_id: 'cust-001',
      closed: false,
    });
    expect(result?.company).toMatchObject({
      id: 'cust-001',
      name: '測試股份有限公司',
      link: 'https://www.104.com.tw/company/cust-001',
      type: '軟體及網路相關業',
    });
    expect(result?.jobKeyword?.id).toBe('job-001');
  });

  it('buildPersistItem reproduces the closed-fallback branch for empty-description existing items', async () => {
    const passedConfig = await loadPassedConfig([]);

    const existingItem = {
      id: 'job-001',
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
      created_at: new Date('2025-01-01T00:00:00.000Z'),
    };
    const item: JobOnAPI & RequireToCrawlJob = {
      ...buildJobOnAPIFixture(),
      id: 'job-001',
      title: '資深後端工程師',
      url: 'https://www.104.com.tw/job/job-001',
      existingItem,
      needToCreate: false,
    };
    const detail = buildDetailFixture({ description: '' });

    const result = passedConfig.buildPersistItem(item, detail);

    expect(result).toBeDefined();
    expect(result?.job.id).toBe('job-001');
    expect((result?.job as { closed?: boolean }).closed).toBe(true);
    expect(result?.company).toBeUndefined();
    expect(result?.jobKeyword).toBeUndefined();
  });

  it('buildPersistItem returns undefined for empty-description with no existing item, matching pre-migration behavior of persisting nothing', async () => {
    const passedConfig = await loadPassedConfig([]);

    const item: JobOnAPI & RequireToCrawlJob = {
      ...buildJobOnAPIFixture(),
      id: 'job-002',
      title: '前端工程師',
      url: 'https://www.104.com.tw/job/job-002',
      existingItem: undefined,
      needToCreate: true,
    };
    const detail = buildDetailFixture({ description: '' });

    const result = passedConfig.buildPersistItem(item, detail);

    expect(result).toBeUndefined();
  });
});
