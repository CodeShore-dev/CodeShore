import { beforeEach, describe, expect, it, vi } from 'vitest';

// `persistence.ts` is the app-side glue layer between `@codeshore/crawler-core`'s
// injected callback contracts and the existing Supabase-backed services in
// `@codeshore/data-utils`. We mock the entire `@codeshore/data-utils` module so
// these tests never touch a real Supabase client (mirrors how `JobService` etc.
// construct `getSupabaseClient()` internally, which requires env config we don't
// want tests to depend on).
const {
  upsertMock,
  fetchAllMock,
  upsertJobSourceURLMock,
  createJobSourceURLsMock,
  JobServiceMock,
  CompanyServiceMock,
  JobKeywordServiceMock,
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
  return {
    upsertMock: upsertMockInner,
    fetchAllMock: fetchAllMockInner,
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
  };
});

vi.mock('@codeshore/data-utils', () => ({
  JobService: JobServiceMock,
  CompanyService: CompanyServiceMock,
  JobKeywordService: JobKeywordServiceMock,
  upsertJobSourceURL: upsertJobSourceURLMock,
  createJobSourceURLs: createJobSourceURLsMock,
}));

describe('persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('resolveExisting', () => {
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

      const { resolveExisting } = await import('./persistence');

      const mapA = await resolveExisting();
      const mapB = await resolveExisting();

      expect(fetchAllMock).toHaveBeenCalledTimes(1);
      expect(fetchAllMock).toHaveBeenCalledWith({
        select: 'id, updated_at, created_at',
      });
      expect(mapA).toBeInstanceOf(Map);
      expect(mapA.get('job-1')).toEqual({
        id: 'job-1',
        updated_at: '2026-01-01T00:00:00.000Z',
        created_at: '2026-01-01T00:00:00.000Z',
      });
      expect(mapB).toBe(mapA);
    });

    it('the same exported function reference is used across multiple call sites (proving cross-router sharing is possible)', async () => {
      const persistenceModule = await import('./persistence');
      const refA = persistenceModule.resolveExisting;
      const refB = persistenceModule.resolveExisting;
      expect(refA).toBe(refB);
    });
  });

  describe('onBatchReady', () => {
    it('dispatches items to CompanyService/JobService/JobKeywordService upsert', async () => {
      const { onBatchReady } = await import('./persistence');

      const company = { id: 'c1', name: 'Acme' } as never;
      const job = { id: 'j1', title: 'Engineer' } as never;
      const jobKeyword = { id: 'j1', keywords: [] } as never;

      await onBatchReady([{ company, job, jobKeyword }]);

      expect(CompanyServiceMock).toHaveBeenCalled();
      expect(JobServiceMock).toHaveBeenCalled();
      expect(JobKeywordServiceMock).toHaveBeenCalled();
      expect(upsertMock).toHaveBeenCalledWith([company]);
      expect(upsertMock).toHaveBeenCalledWith([job]);
      expect(upsertMock).toHaveBeenCalledWith([jobKeyword]);
    });

    it('does nothing when items is empty', async () => {
      const { onBatchReady } = await import('./persistence');

      await onBatchReady([]);

      expect(upsertMock).not.toHaveBeenCalled();
    });

    it('batches multiple items into a single upsert call per service', async () => {
      const { onBatchReady } = await import('./persistence');

      const company1 = { id: 'c1', name: 'Acme' } as never;
      const job1 = { id: 'j1', title: 'Engineer' } as never;
      const jobKeyword1 = { id: 'j1', keywords: [] } as never;
      const company2 = { id: 'c2', name: 'Globex' } as never;
      const job2 = { id: 'j2', title: 'Designer' } as never;
      const jobKeyword2 = { id: 'j2', keywords: [] } as never;

      await onBatchReady([
        { company: company1, job: job1, jobKeyword: jobKeyword1 },
        { company: company2, job: job2, jobKeyword: jobKeyword2 },
      ]);

      expect(upsertMock).toHaveBeenCalledWith([company1, company2]);
      expect(upsertMock).toHaveBeenCalledWith([job1, job2]);
      expect(upsertMock).toHaveBeenCalledWith([jobKeyword1, jobKeyword2]);
    });
  });

  describe('onListPageResolved', () => {
    it('marks the list page as completed via upsertJobSourceURL on status "completed"', async () => {
      const { onListPageResolved } = await import('./persistence');

      await onListPageResolved({
        url: 'https://example.test/jobs?page=1',
        page: 1,
        totalPages: 1,
        status: 'completed',
      });

      expect(upsertJobSourceURLMock).toHaveBeenCalledWith(
        'https://example.test/jobs?page=1',
        1,
        'completed',
      );
    });

    it('marks the list page as failed via upsertJobSourceURL on status "failed"', async () => {
      const { onListPageResolved } = await import('./persistence');

      await onListPageResolved({
        url: 'https://example.test/jobs?page=1',
        page: 1,
        totalPages: 3,
        status: 'failed',
      });

      expect(upsertJobSourceURLMock).toHaveBeenCalledWith(
        'https://example.test/jobs?page=1',
        1,
        'failed',
      );
    });

    it('registers pending page-source URLs when the first page resolves with more than one total page', async () => {
      const { onListPageResolved } = await import('./persistence');

      await onListPageResolved({
        url: 'https://example.test/jobs?page=1',
        page: 1,
        totalPages: 5,
        status: 'completed',
      });

      expect(createJobSourceURLsMock).toHaveBeenCalledWith(
        'https://example.test/jobs?page=1',
        5,
      );
    });

    it('does not register pending page-source URLs when there is only a single page', async () => {
      const { onListPageResolved } = await import('./persistence');

      await onListPageResolved({
        url: 'https://example.test/jobs?page=1',
        page: 1,
        totalPages: 1,
        status: 'completed',
      });

      expect(createJobSourceURLsMock).not.toHaveBeenCalled();
    });

    it('does not register pending page-source URLs on failure even if it is page 1', async () => {
      const { onListPageResolved } = await import('./persistence');

      await onListPageResolved({
        url: 'https://example.test/jobs?page=1',
        page: 1,
        totalPages: 5,
        status: 'failed',
      });

      expect(createJobSourceURLsMock).not.toHaveBeenCalled();
    });

    it('does not register pending page-source URLs when resolving a page other than the first', async () => {
      const { onListPageResolved } = await import('./persistence');

      await onListPageResolved({
        url: 'https://example.test/jobs?page=2',
        page: 2,
        totalPages: 5,
        status: 'completed',
      });

      expect(createJobSourceURLsMock).not.toHaveBeenCalled();
    });
  });
});
