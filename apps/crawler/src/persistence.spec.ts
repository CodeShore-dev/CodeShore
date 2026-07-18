import { beforeEach, describe, expect, it, vi } from 'vitest';

// `persistence.ts` is the app-side glue layer between `@codeshore/sync-core`'s
// injected abstract interface contracts (`SyncRepository`/`SourceRegistry`) and
// the existing Supabase-backed services in `@codeshore/data-utils`. We mock the
// entire `@codeshore/data-utils` module so these tests never touch a real
// Supabase client (mirrors how `JobService` etc. construct `getSupabaseClient()`
// internally, which requires env config we don't want tests to depend on).
const {
  upsertMock,
  fetchAllMock,
  jobSourceUrlFetchAllMock,
  jobSourceUrlClearAllMock,
  jobSourceFetchAllMock,
  upsertJobSourceURLMock,
  createJobSourceURLsMock,
  JobServiceMock,
  CompanyServiceMock,
  JobKeywordServiceMock,
  JobSourceServiceMock,
  JobSourceURLServiceMock,
} = vi.hoisted(() => {
  const upsertMockInner = vi.fn(async () => undefined);
  const fetchAllMockInner = vi.fn(async () => ({
    result: [] as {
      id: string;
      updated_at: string;
      created_at: string;
    }[],
    count: 0,
    searchParams: '',
  }));
  const jobSourceUrlFetchAllMockInner = vi.fn(async () => ({
    result: [] as {
      url: string;
      page_index: number;
      status: string;
    }[],
    count: 0,
    searchParams: '',
  }));
  const jobSourceFetchAllMockInner = vi.fn(async () => ({
    result: [] as { url: string }[],
    count: 0,
    searchParams: '',
  }));
  const jobSourceUrlClearAllMockInner = vi.fn(async () => undefined);
  return {
    upsertMock: upsertMockInner,
    fetchAllMock: fetchAllMockInner,
    jobSourceUrlFetchAllMock: jobSourceUrlFetchAllMockInner,
    jobSourceUrlClearAllMock: jobSourceUrlClearAllMockInner,
    jobSourceFetchAllMock: jobSourceFetchAllMockInner,
    upsertJobSourceURLMock: vi.fn(async () => undefined),
    createJobSourceURLsMock: vi.fn(async () => undefined),
    JobServiceMock: vi.fn(() => ({
      upsert: upsertMockInner,
      fetchAll: fetchAllMockInner,
    })),
    CompanyServiceMock: vi.fn(() => ({
      upsert: upsertMockInner,
    })),
    JobKeywordServiceMock: vi.fn(() => ({
      upsert: upsertMockInner,
    })),
    JobSourceServiceMock: vi.fn(() => ({
      fetchAll: jobSourceFetchAllMockInner,
    })),
    JobSourceURLServiceMock: vi.fn(() => ({
      fetchAll: jobSourceUrlFetchAllMockInner,
      clearAll: jobSourceUrlClearAllMockInner,
    })),
  };
});

vi.mock('@codeshore/data-utils', () => ({
  JobService: JobServiceMock,
  CompanyService: CompanyServiceMock,
  JobKeywordService: JobKeywordServiceMock,
  JobSourceService: JobSourceServiceMock,
  JobSourceURLService: JobSourceURLServiceMock,
  upsertJobSourceURL: upsertJobSourceURLMock,
  createJobSourceURLs: createJobSourceURLsMock,
}));

describe('persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('syncRepository.fetchExisting', () => {
    it('memoizes at module level: two calls only trigger one underlying fetch', async () => {
      fetchAllMock.mockResolvedValueOnce({
        result: [
          {
            id: 'job-1',
            updated_at: '2026-01-01T00:00:00.000Z',
            created_at: '2026-01-01T00:00:00.000Z',
          },
        ],
        count: 1,
        searchParams: '',
      });

      const { syncRepository } = await import('./persistence');

      const mapA = await syncRepository.fetchExisting();
      const mapB = await syncRepository.fetchExisting();

      expect(fetchAllMock).toHaveBeenCalledTimes(1);
      expect(fetchAllMock).toHaveBeenCalledWith({
        select:
          'id, updated_at, created_at, title, description, location, salary, salary_manual, closed',
      });
      expect(mapA).toBeInstanceOf(Map);
      expect(mapA.get('job-1')).toEqual({
        id: 'job-1',
        updated_at: '2026-01-01T00:00:00.000Z',
        created_at: '2026-01-01T00:00:00.000Z',
      });
      expect(mapB).toBe(mapA);
    });

    it('the same exported object reference is used across multiple call sites (proving cross-router sharing is possible)', async () => {
      const persistenceModule = await import('./persistence');
      const refA = persistenceModule.syncRepository;
      const refB = persistenceModule.syncRepository;
      expect(refA).toBe(refB);
    });
  });

  describe('syncRepository.upsertEntities', () => {
    it('dispatches items to CompanyService/JobService/JobKeywordService upsert', async () => {
      const { syncRepository } = await import('./persistence');

      const company = { id: 'c1', name: 'Acme' } as never;
      const job = { id: 'j1', title: 'Engineer' } as never;
      const jobKeyword = { id: 'j1', keywords: [] } as never;

      await syncRepository.upsertEntities([{ company, job, jobKeyword }]);

      expect(CompanyServiceMock).toHaveBeenCalled();
      expect(JobServiceMock).toHaveBeenCalled();
      expect(JobKeywordServiceMock).toHaveBeenCalled();
      expect(upsertMock).toHaveBeenCalledWith([company]);
      expect(upsertMock).toHaveBeenCalledWith([job]);
      expect(upsertMock).toHaveBeenCalledWith([jobKeyword]);
    });

    it('does nothing when entities is empty', async () => {
      const { syncRepository } = await import('./persistence');

      await syncRepository.upsertEntities([]);

      expect(upsertMock).not.toHaveBeenCalled();
    });

    it('batches multiple items into a single upsert call per service', async () => {
      const { syncRepository } = await import('./persistence');

      const company1 = { id: 'c1', name: 'Acme' } as never;
      const job1 = { id: 'j1', title: 'Engineer' } as never;
      const jobKeyword1 = { id: 'j1', keywords: [] } as never;
      const company2 = { id: 'c2', name: 'Globex' } as never;
      const job2 = { id: 'j2', title: 'Designer' } as never;
      const jobKeyword2 = { id: 'j2', keywords: [] } as never;

      await syncRepository.upsertEntities([
        { company: company1, job: job1, jobKeyword: jobKeyword1 },
        { company: company2, job: job2, jobKeyword: jobKeyword2 },
      ]);

      expect(upsertMock).toHaveBeenCalledWith([company1, company2]);
      expect(upsertMock).toHaveBeenCalledWith([job1, job2]);
      expect(upsertMock).toHaveBeenCalledWith([jobKeyword1, jobKeyword2]);
    });

    it('omits closed-fallback items without company/jobKeyword from their respective upserts', async () => {
      const { syncRepository } = await import('./persistence');

      const job = { id: 'j1', title: 'Engineer', closed: true } as never;

      await syncRepository.upsertEntities([{ job }]);

      expect(CompanyServiceMock).not.toHaveBeenCalled();
      expect(JobKeywordServiceMock).not.toHaveBeenCalled();
      expect(JobServiceMock).toHaveBeenCalled();
      expect(upsertMock).toHaveBeenCalledWith([job]);
    });
  });

  describe('sourceRegistry.fetchPendingSources', () => {
    it('queries job_source_url for pending rows ordered by url then page_index', async () => {
      jobSourceUrlFetchAllMock.mockResolvedValueOnce({
        result: [
          { url: 'https://example.test/jobs', page_index: 2, status: 'pending' },
          { url: 'https://example.test/jobs', page_index: 3, status: 'pending' },
        ],
        count: 2,
        searchParams: '',
      });

      const { sourceRegistry } = await import('./persistence');

      const locations = await sourceRegistry.fetchPendingSources();

      expect(jobSourceUrlFetchAllMock).toHaveBeenCalledWith({
        where: { status: { eq: 'pending' } },
        orders: [
          { column: 'url', ascending: true },
          { column: 'page_index', ascending: true },
        ],
      });
      expect(locations).toEqual([
        { url: 'https://example.test/jobs', pageIndex: 2 },
        { url: 'https://example.test/jobs', pageIndex: 3 },
      ]);
    });
  });

  describe('sourceRegistry.fetchBaseSources', () => {
    it('returns base source URLs from JobSourceService', async () => {
      jobSourceFetchAllMock.mockResolvedValueOnce({
        result: [
          { url: 'https://example.test/jobs-a' },
          { url: 'https://example.test/jobs-b' },
        ],
        count: 2,
        searchParams: '',
      });

      const { sourceRegistry } = await import('./persistence');

      const urls = await sourceRegistry.fetchBaseSources();

      expect(JobSourceServiceMock).toHaveBeenCalled();
      expect(urls).toEqual([
        'https://example.test/jobs-a',
        'https://example.test/jobs-b',
      ]);
    });
  });

  describe('sourceRegistry.registerPendingPages', () => {
    it('delegates to createJobSourceURLs with url and totalPages', async () => {
      const { sourceRegistry } = await import('./persistence');

      await sourceRegistry.registerPendingPages(
        'https://example.test/jobs?page=1',
        5,
      );

      expect(createJobSourceURLsMock).toHaveBeenCalledWith(
        'https://example.test/jobs?page=1',
        5,
      );
    });
  });

  describe('sourceRegistry.markSourceStatus', () => {
    it('delegates to upsertJobSourceURL with url, pageIndex, and status "completed"', async () => {
      const { sourceRegistry } = await import('./persistence');

      await sourceRegistry.markSourceStatus(
        'https://example.test/jobs?page=1',
        1,
        'completed',
      );

      expect(upsertJobSourceURLMock).toHaveBeenCalledWith(
        'https://example.test/jobs?page=1',
        1,
        'completed',
      );
    });

    it('delegates to upsertJobSourceURL with url, pageIndex, and status "failed"', async () => {
      const { sourceRegistry } = await import('./persistence');

      await sourceRegistry.markSourceStatus(
        'https://example.test/jobs?page=1',
        1,
        'failed',
      );

      expect(upsertJobSourceURLMock).toHaveBeenCalledWith(
        'https://example.test/jobs?page=1',
        1,
        'failed',
      );
    });
  });

  describe('sourceRegistry.clearAll', () => {
    it('delegates to JobSourceURLService().clearAll()', async () => {
      const { sourceRegistry } = await import('./persistence');

      await sourceRegistry.clearAll();

      expect(JobSourceURLServiceMock).toHaveBeenCalled();
      expect(jobSourceUrlClearAllMock).toHaveBeenCalledTimes(1);
    });
  });
});
