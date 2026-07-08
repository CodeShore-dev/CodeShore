import { Service } from './service';

/**
 * Constructor-injected-fake convention per `company/service.spec.ts` and
 * `ai-suggestion/service.spec.ts`. Only `techService`/`techKeywordService`/
 * `techParentService`/`keywordService` are exercised by task 4.1's new
 * methods (`createTech`/`updateTech`/`deleteTech`/`deleteKeyword`); the
 * remaining constructor args default to empty stubs since the pre-existing
 * methods under test elsewhere (`getMvTech`, `updateTechIconSlugs`, etc.) are
 * out of this task's boundary.
 */
function createService(
  overrides: {
    cacheService?: any;
    techService?: any;
    techKeywordService?: any;
    techParentService?: any;
    keywordService?: any;
    mvTechService?: any;
    mvTechCategoryService?: any;
  } = {},
): Service {
  return new Service(
    overrides.cacheService ?? {},
    overrides.techService ?? {},
    overrides.techKeywordService ?? {},
    overrides.techParentService ?? {},
    overrides.keywordService ?? {},
    overrides.mvTechService ?? {},
    overrides.mvTechCategoryService ?? {},
  ) as any;
}

const ok = { error: null };

describe('Service.createTech', () => {
  it('creates a tech with keywords and a parent: upserts tech, upserts keywords, and upserts the parent edge', async () => {
    const techService = { upsert: vi.fn().mockResolvedValue(ok) };
    const techKeywordService = { upsert: vi.fn().mockResolvedValue(ok) };
    const techParentService = { upsert: vi.fn().mockResolvedValue(ok) };
    const service = createService({
      techService,
      techKeywordService,
      techParentService,
    });

    const result = await service.createTech(
      'solidjs',
      ['solidjs', 'solid-js'],
      'frontend',
      'javascript',
    );

    expect(techService.upsert).toHaveBeenCalledWith([
      { id: 'solidjs', category: 'frontend', label: 'solidjs', tags: [] },
    ]);
    expect(techKeywordService.upsert).toHaveBeenCalledWith([
      { tech: 'solidjs', keyword: 'solidjs' },
      { tech: 'solidjs', keyword: 'solid-js' },
    ]);
    expect(techParentService.upsert).toHaveBeenCalledWith([
      { parent: 'javascript', child: 'solidjs' },
    ]);
    expect(result).toEqual({ id: 'solidjs' });
  });

  it('creates a tech with no keywords and no parent: only TechService.upsert is called', async () => {
    const techService = { upsert: vi.fn().mockResolvedValue(ok) };
    const techKeywordService = { upsert: vi.fn() };
    const techParentService = { upsert: vi.fn() };
    const service = createService({
      techService,
      techKeywordService,
      techParentService,
    });

    const result = await service.createTech('solidjs', [], 'frontend', null);

    expect(techService.upsert).toHaveBeenCalledWith([
      { id: 'solidjs', category: 'frontend', label: 'solidjs', tags: [] },
    ]);
    expect(techKeywordService.upsert).not.toHaveBeenCalled();
    expect(techParentService.upsert).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'solidjs' });
  });

  it('throws when the tech upsert itself fails', async () => {
    const techService = {
      upsert: vi.fn().mockResolvedValue({ error: { message: 'db unavailable' } }),
    };
    const service = createService({ techService });

    await expect(
      service.createTech('solidjs', [], 'frontend', null),
    ).rejects.toThrow('db unavailable');
  });
});

describe('Service.updateTech', () => {
  it("updates only the tech's category: only TechService.update is called, no keyword/parent service is touched", async () => {
    const techService = { update: vi.fn().mockResolvedValue(ok) };
    const techKeywordService = {
      fetchAll: vi.fn(),
      upsert: vi.fn(),
      deleteByTechAndKeyword: vi.fn(),
    };
    const techParentService = {
      fetchAll: vi.fn(),
      upsert: vi.fn(),
      deleteByParentAndChild: vi.fn(),
    };
    const service = createService({
      techService,
      techKeywordService,
      techParentService,
    });

    const result = await service.updateTech('react', { category: 'library' });

    expect(techService.update).toHaveBeenCalledWith({
      id: 'react',
      category: 'library',
    });
    expect(techKeywordService.fetchAll).not.toHaveBeenCalled();
    expect(techKeywordService.upsert).not.toHaveBeenCalled();
    expect(techKeywordService.deleteByTechAndKeyword).not.toHaveBeenCalled();
    expect(techParentService.fetchAll).not.toHaveBeenCalled();
    expect(techParentService.upsert).not.toHaveBeenCalled();
    expect(techParentService.deleteByParentAndChild).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'react' });
  });

  it("diffs the tech's keywords: deletes mappings no longer present, upserts newly-added ones, leaves unchanged ones alone", async () => {
    const techService = { update: vi.fn() };
    const techKeywordService = {
      fetchAll: vi.fn().mockResolvedValue({
        result: [
          { tech: 'react', keyword: 'react' },
          { tech: 'react', keyword: 'reactjs' },
          { tech: 'react', keyword: 'react-js' },
        ],
        count: 3,
        searchParams: '',
      }),
      deleteByTechAndKeyword: vi.fn().mockResolvedValue(ok),
      upsert: vi.fn().mockResolvedValue(ok),
    };
    const service = createService({ techService, techKeywordService });

    const result = await service.updateTech('react', {
      keywords: ['react', 'reactjs', 'react.js'],
    });

    expect(techKeywordService.fetchAll).toHaveBeenCalledWith({
      where: { tech: { eq: 'react' } },
    });
    expect(techKeywordService.deleteByTechAndKeyword).toHaveBeenCalledTimes(1);
    expect(techKeywordService.deleteByTechAndKeyword).toHaveBeenCalledWith(
      'react',
      'react-js',
    );
    expect(techKeywordService.upsert).toHaveBeenCalledWith([
      { tech: 'react', keyword: 'react.js' },
    ]);
    expect(techService.update).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'react' });
  });

  it("updates the tech's parent to a new value: the old edge is removed and the new edge is added", async () => {
    const techParentService = {
      fetchAll: vi.fn().mockResolvedValue({
        result: [{ parent: 'javascript', child: 'react' }],
        count: 1,
        searchParams: '',
      }),
      deleteByParentAndChild: vi.fn().mockResolvedValue(ok),
      upsert: vi.fn().mockResolvedValue(ok),
    };
    const service = createService({ techParentService });

    const result = await service.updateTech('react', { parent: 'typescript' });

    expect(techParentService.fetchAll).toHaveBeenCalledWith({
      where: { child: { eq: 'react' } },
    });
    expect(techParentService.deleteByParentAndChild).toHaveBeenCalledWith(
      'javascript',
      'react',
    );
    expect(techParentService.upsert).toHaveBeenCalledWith([
      { parent: 'typescript', child: 'react' },
    ]);
    expect(result).toEqual({ id: 'react' });
  });

  it("updates the tech's parent to null: the old edge is removed and no new edge is added", async () => {
    const techParentService = {
      fetchAll: vi.fn().mockResolvedValue({
        result: [{ parent: 'javascript', child: 'react' }],
        count: 1,
        searchParams: '',
      }),
      deleteByParentAndChild: vi.fn().mockResolvedValue(ok),
      upsert: vi.fn(),
    };
    const service = createService({ techParentService });

    const result = await service.updateTech('react', { parent: null });

    expect(techParentService.deleteByParentAndChild).toHaveBeenCalledWith(
      'javascript',
      'react',
    );
    expect(techParentService.upsert).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'react' });
  });

  it('throws when the category update itself fails', async () => {
    const techService = {
      update: vi.fn().mockResolvedValue({ error: { message: 'db unavailable' } }),
    };
    const service = createService({ techService });

    await expect(
      service.updateTech('react', { category: 'library' }),
    ).rejects.toThrow('db unavailable');
  });
});

describe('Service.deleteTech', () => {
  it('deletes a tech via TechService.delete with the given id', async () => {
    const techService = { delete: vi.fn().mockResolvedValue(ok) };
    const service = createService({ techService });

    const result = await service.deleteTech('react');

    expect(techService.delete).toHaveBeenCalledWith('react');
    expect(result).toEqual({ id: 'react' });
  });

  it('throws when the delete itself fails', async () => {
    const techService = {
      delete: vi.fn().mockResolvedValue({ error: { message: 'db unavailable' } }),
    };
    const service = createService({ techService });

    await expect(service.deleteTech('react')).rejects.toThrow('db unavailable');
  });
});

describe('Service.deleteKeyword', () => {
  it('deletes a bare keyword via KeywordService.delete with the given id', async () => {
    const keywordService = { delete: vi.fn().mockResolvedValue(ok) };
    const service = createService({ keywordService });

    const result = await service.deleteKeyword('some-noise-word');

    expect(keywordService.delete).toHaveBeenCalledWith('some-noise-word');
    expect(result).toEqual({ id: 'some-noise-word' });
  });

  it('throws when the delete itself fails', async () => {
    const keywordService = {
      delete: vi.fn().mockResolvedValue({ error: { message: 'db unavailable' } }),
    };
    const service = createService({ keywordService });

    await expect(
      service.deleteKeyword('some-noise-word'),
    ).rejects.toThrow('db unavailable');
  });
});
