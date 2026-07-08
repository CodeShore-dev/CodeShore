// `approve()` (task 2.2) validates hierarchy suggestions via
// `detectTechParentCycle` and triggers `refreshAllMaterializedViews` after a
// successful write -- both are mocked at the module boundary per the
// implementer protocol, rather than exercising real Postgres/RPC calls.
vi.mock('@codeshore/data-utils', () => ({
  refreshAllMaterializedViews: vi.fn(),
}));
vi.mock('./validation/cycle-check', () => ({
  detectTechParentCycle: vi.fn(),
}));
// `Service.generate()` resolves the effective model, then constructs a
// fresh `OpenRouterLlmClient(model)` for that one run (see service.ts's
// model-resolution comment). Mocking the class here lets the model
// resolution tests below assert on the constructor call args directly,
// instead of needing a real `OPENROUTER_API_KEY` / network call.
// `vi.hoisted` is required (not a plain top-level `const`) because
// `vi.mock`'s factory is itself hoisted above all imports/top-level
// variables -- referencing a non-hoisted `const` from inside it throws a
// temporal-dead-zone `ReferenceError`.
const { openRouterLlmClientCtor } = vi.hoisted(() => ({
  openRouterLlmClientCtor: vi.fn(),
}));
vi.mock('./llm-client', () => ({
  OpenRouterLlmClient: openRouterLlmClientCtor,
}));

import { refreshAllMaterializedViews } from '@codeshore/data-utils';

import { detectTechParentCycle } from './validation/cycle-check';
import { DEFAULT_MODEL_FALLBACK, Service } from './service';
import { getWorkflowInfo } from './workflow-info';

const baseRecord = {
  id: 'suggestion-1',
  target_table: 'tech_keyword',
  workflow: 'keyword_mapping',
  action: 'insert',
  target_key: { tech: 'react', keyword: 'reactjs' },
  payload: { tech: 'react', keyword: 'reactjs' },
  evidence: {
    reasoning: 'reactjs is a common alias for react',
    confidence: 0.92,
    affectedCount: 12,
  },
  status: 'pending',
  flagged_for_review: false,
  created_at: '2026-07-01T00:00:00.000Z',
  reviewed_by: null,
  reviewed_at: null,
  resolution_note: null,
  outcome: null,
};

/**
 * Builds a `Service` with constructor-injected fakes, following
 * `company/service.spec.ts`'s established convention. Every dependency
 * defaults to an empty stub object so tests that only exercise
 * `list`/`getById`/`createSuggestion` (which don't touch the target-table
 * writers or mv-count readers `approve()` added) don't need to know about
 * them.
 */
function createService(
  overrides: {
    aiSuggestionService?: any;
    jobDescriptionBinService?: any;
    techService?: any;
    keywordBinService?: any;
    techKeywordService?: any;
    techParentService?: any;
    locationGroupService?: any;
    locationGroupLocationService?: any;
    mvTechService?: any;
    mvLocationGroupService?: any;
    keywordService?: any;
    jobKeywordService?: any;
    jobService?: any;
    llmSettingService?: any;
  } = {},
): Service {
  return new Service(
    overrides.aiSuggestionService ?? {},
    overrides.jobDescriptionBinService ?? {},
    overrides.techService ?? {},
    overrides.keywordBinService ?? {},
    overrides.techKeywordService ?? {},
    overrides.techParentService ?? {},
    overrides.locationGroupService ?? {},
    overrides.locationGroupLocationService ?? {},
    overrides.mvTechService ?? {},
    overrides.mvLocationGroupService ?? {},
    overrides.keywordService ?? {},
    overrides.jobKeywordService ?? {},
    overrides.jobService ?? {},
    overrides.llmSettingService ?? {},
  ) as any;
}

/** Yields a fixed, controllable sequence of `MvRefreshEvent`s. */
async function* refreshEvents(events: any[]) {
  for (const event of events) {
    yield event;
  }
}

const refreshSuccess = () => [
  { type: 'log', step: 'mv_tech', message: '[1/1] mv_tech 開始執行' },
  { type: 'log', step: 'mv_tech', message: '[1/1] mv_tech 完成' },
  { type: 'done', success: true },
];

const refreshFailure = () => [
  { type: 'log', step: 'mv_tech', message: '[1/1] mv_tech 開始執行' },
  { type: 'error', step: 'mv_tech', message: 'refresh_mv_tech RPC failed' },
  { type: 'done', success: false },
];

describe('Service.list', () => {
  it('delegates to AiSuggestionService.listByTargetAndStatus with no filter and returns its result', async () => {
    const expected = { result: [baseRecord], count: 1, searchParams: '' };
    const aiSuggestionService = {
      listByTargetAndStatus: vi.fn().mockResolvedValue(expected),
    };
    const service = createService({ aiSuggestionService });

    const result = await service.list();

    expect(
      aiSuggestionService.listByTargetAndStatus,
    ).toHaveBeenCalledWith({});
    expect(result.result).toEqual([baseRecord]);
    expect(result.count).toBe(1);
  });

  it('passes a targetTable/status filter straight through to listByTargetAndStatus', async () => {
    const expected = { result: [], count: 0, searchParams: '' };
    const aiSuggestionService = {
      listByTargetAndStatus: vi.fn().mockResolvedValue(expected),
    };
    const service = createService({ aiSuggestionService });

    const result = await service.list({
      targetTable: 'tech_keyword',
      status: 'pending',
    });

    expect(
      aiSuggestionService.listByTargetAndStatus,
    ).toHaveBeenCalledWith({
      targetTable: 'tech_keyword',
      status: 'pending',
    });
    expect(result.result).toEqual([]);
    expect(result.count).toBe(0);
  });
});

describe('Service.getById', () => {
  it('returns { found: true, record } with the full evidence sub-fields when a matching row exists', async () => {
    const aiSuggestionService = {
      fetchAll: vi.fn().mockResolvedValue({
        result: [baseRecord],
        count: 1,
        searchParams: '',
      }),
    };
    const service = createService({ aiSuggestionService });

    const result = await service.getById('suggestion-1');

    expect(aiSuggestionService.fetchAll).toHaveBeenCalledWith({
      where: { id: { eq: 'suggestion-1' } },
    });
    expect(result).toEqual({ found: true, record: baseRecord });
    if (result.found) {
      expect(result.record.evidence).toEqual({
        reasoning: 'reactjs is a common alias for react',
        confidence: 0.92,
        affectedCount: 12,
      });
    }
  });

  it('returns { found: false } rather than throwing when no row matches the id', async () => {
    const aiSuggestionService = {
      fetchAll: vi.fn().mockResolvedValue({
        result: [],
        count: 0,
        searchParams: '',
      }),
    };
    const service = createService({ aiSuggestionService });

    const result = await service.getById('does-not-exist');

    expect(result).toEqual({ found: false });
  });
});

describe('Service.createSuggestion', () => {
  it('surfaces a created outcome from createPendingSuggestion', async () => {
    const created = { outcome: 'created', record: baseRecord };
    const aiSuggestionService = {
      createPendingSuggestion: vi.fn().mockResolvedValue(created),
    };
    const service = createService({ aiSuggestionService });
    const input = {
      target_table: 'tech_keyword',
      workflow: 'keyword_mapping',
      action: 'insert',
      target_key: { tech: 'react', keyword: 'reactjs' },
      payload: { tech: 'react', keyword: 'reactjs' },
      evidence: { reasoning: 'reactjs is a common alias for react' },
    };

    const result = await service.createSuggestion(input as any);

    expect(
      aiSuggestionService.createPendingSuggestion,
    ).toHaveBeenCalledWith(input);
    expect(result).toBe(created);
    expect(result.outcome).toBe('created');
  });

  it('surfaces a duplicate outcome without throwing', async () => {
    const duplicate = {
      outcome: 'duplicate',
      targetTable: 'tech_keyword',
      workflow: 'keyword_mapping',
      targetKey: { tech: 'react', keyword: 'reactjs' },
    };
    const aiSuggestionService = {
      createPendingSuggestion: vi.fn().mockResolvedValue(duplicate),
    };
    const service = createService({ aiSuggestionService });

    const result = await service.createSuggestion({
      target_table: 'tech_keyword',
      workflow: 'keyword_mapping',
      action: 'insert',
      target_key: { tech: 'react', keyword: 'reactjs' },
      payload: {},
      evidence: { reasoning: 'x' },
    } as any);

    expect(result.outcome).toBe('duplicate');
    expect(result).toBe(duplicate);
  });

  it('surfaces an error outcome without throwing', async () => {
    const errorResult = {
      outcome: 'error',
      error: { message: 'db unavailable', code: '500' },
    };
    const aiSuggestionService = {
      createPendingSuggestion: vi.fn().mockResolvedValue(errorResult),
    };
    const service = createService({ aiSuggestionService });

    const result = await service.createSuggestion({
      target_table: 'tech_keyword',
      workflow: 'keyword_mapping',
      action: 'insert',
      target_key: { tech: 'react', keyword: 'reactjs' },
      payload: {},
      evidence: { reasoning: 'x' },
    } as any);

    expect(result.outcome).toBe('error');
    expect(result).toBe(errorResult);
  });
});

describe('Service.approve', () => {
  beforeEach(() => {
    vi.mocked(detectTechParentCycle).mockReset();
    vi.mocked(refreshAllMaterializedViews).mockReset();
    vi.mocked(refreshAllMaterializedViews).mockImplementation(() =>
      refreshEvents(refreshSuccess()),
    );
  });

  it('rejects a tech_parent suggestion that would create a cycle, leaving it pending and untouched', async () => {
    const suggestion = {
      ...baseRecord,
      id: 'suggestion-cycle',
      target_table: 'tech_parent',
      workflow: 'tech_hierarchy',
      action: 'insert',
      target_key: { parent: 'backend', child: 'nodejs' },
      payload: { parent: 'backend', child: 'nodejs' },
      evidence: { reasoning: 'x' },
    };
    const aiSuggestionService = {
      fetchAll: vi
        .fn()
        .mockResolvedValue({ result: [suggestion], count: 1, searchParams: '' }),
      markApproved: vi.fn(),
    };
    const techParentService = {
      upsert: vi.fn(),
      updateByParentAndChild: vi.fn(),
      deleteByParentAndChild: vi.fn(),
    };
    vi.mocked(detectTechParentCycle).mockResolvedValue({
      hasCycle: true,
      conflictPath: ['nodejs', 'backend'],
    });
    const service = createService({ aiSuggestionService, techParentService });

    const result = await service.approve(
      'suggestion-cycle',
      undefined,
      'reviewer-1',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('conflict');
      expect(result.error.message).toContain('nodejs -> backend');
    }
    expect(detectTechParentCycle).toHaveBeenCalledWith('backend', 'nodejs');
    expect(techParentService.upsert).not.toHaveBeenCalled();
    expect(aiSuggestionService.markApproved).not.toHaveBeenCalled();
    expect(refreshAllMaterializedViews).not.toHaveBeenCalled();
  });

  it('approves a valid tech_keyword suggestion: writes via the composite-key method, triggers refresh, and transitions to approved', async () => {
    const suggestion = {
      ...baseRecord,
      id: 'suggestion-tk',
      target_table: 'tech_keyword',
      workflow: 'keyword_mapping',
      action: 'insert',
      target_key: { tech: 'react', keyword: 'reactjs' },
      payload: { tech: 'react', keyword: 'reactjs' },
      evidence: { reasoning: 'x', confidence: 0.9, affectedCount: 10 },
    };
    const approvedRecord = {
      ...suggestion,
      status: 'approved',
      reviewed_by: 'reviewer-1',
    };
    const aiSuggestionService = {
      fetchAll: vi
        .fn()
        .mockResolvedValue({ result: [suggestion], count: 1, searchParams: '' }),
      markApproved: vi
        .fn()
        .mockResolvedValue({ outcome: 'approved', record: approvedRecord }),
    };
    const techKeywordService = {
      upsert: vi.fn().mockResolvedValue({ error: null }),
      updateByTechAndKeyword: vi.fn(),
      deleteByTechAndKeyword: vi.fn(),
    };
    const mvTechService = {
      fetchAll: vi
        .fn()
        .mockResolvedValueOnce({ result: [], count: 100, searchParams: '' })
        .mockResolvedValueOnce({ result: [], count: 105, searchParams: '' }),
    };
    const service = createService({
      aiSuggestionService,
      techKeywordService,
      mvTechService,
    });

    const result = await service.approve('suggestion-tk', undefined, 'reviewer-1');

    expect(techKeywordService.upsert).toHaveBeenCalledWith([
      { tech: 'react', keyword: 'reactjs' },
    ]);
    expect(techKeywordService.updateByTechAndKeyword).not.toHaveBeenCalled();
    expect(refreshAllMaterializedViews).toHaveBeenCalled();
    // |105 - 100| = 5 <= 10 * 3 = 30 -> within bounds. Asserting the full
    // `outcome` diff summary here (not just `flaggedForReview`) keeps this
    // one test as the single coherent chain proving write succeeds, refresh
    // succeeds, the before/after outcome is actually computed from the
    // mv-count reads, and the suggestion transitions to `approved` -- rather
    // than splitting "outcome computed" and "status becomes approved" across
    // separate tests (requirements 8.5, 8.6, 9.1, 9.2).
    expect(aiSuggestionService.markApproved).toHaveBeenCalledWith(
      'suggestion-tk',
      expect.objectContaining({
        payload: { tech: 'react', keyword: 'reactjs' },
        reviewedBy: 'reviewer-1',
        resolutionNote: null,
        flaggedForReview: false,
        outcome: expect.objectContaining({
          beforeCounts: { mv_tech: 100 },
          afterCounts: { mv_tech: 105 },
          exceedsExpectedMagnitude: false,
        }),
      }),
    );
    expect(result).toEqual({ ok: true, record: approvedRecord });
  });

  it('approves a valid tech suggestion (single-id table): writes via the inherited update method with the target_key id merged in', async () => {
    const suggestion = {
      ...baseRecord,
      id: 'suggestion-tech',
      target_table: 'tech',
      workflow: 'tech_dictionary',
      action: 'update',
      target_key: { id: 'golang' },
      payload: { category: 'language', tags: ['backend'] },
      evidence: { reasoning: 'x' },
    };
    const approvedRecord = { ...suggestion, status: 'approved' };
    const aiSuggestionService = {
      fetchAll: vi
        .fn()
        .mockResolvedValue({ result: [suggestion], count: 1, searchParams: '' }),
      markApproved: vi
        .fn()
        .mockResolvedValue({ outcome: 'approved', record: approvedRecord }),
    };
    const techService = {
      upsert: vi.fn(),
      update: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn(),
    };
    const mvTechService = {
      fetchAll: vi
        .fn()
        .mockResolvedValueOnce({ result: [], count: 50, searchParams: '' })
        .mockResolvedValueOnce({ result: [], count: 50, searchParams: '' }),
    };
    const service = createService({
      aiSuggestionService,
      techService,
      mvTechService,
    });

    const result = await service.approve(
      'suggestion-tech',
      undefined,
      'reviewer-1',
    );

    expect(techService.update).toHaveBeenCalledWith({
      category: 'language',
      tags: ['backend'],
      id: 'golang',
    });
    expect(result.ok).toBe(true);
  });

  it('returns write_failed and leaves the suggestion pending when the target-table write fails', async () => {
    const suggestion = {
      ...baseRecord,
      id: 'suggestion-tk',
      target_table: 'tech_keyword',
      action: 'insert',
      target_key: { tech: 'react', keyword: 'reactjs' },
      payload: { tech: 'react', keyword: 'reactjs' },
      evidence: { reasoning: 'x' },
    };
    const aiSuggestionService = {
      fetchAll: vi
        .fn()
        .mockResolvedValue({ result: [suggestion], count: 1, searchParams: '' }),
      markApproved: vi.fn(),
    };
    const techKeywordService = {
      upsert: vi
        .fn()
        .mockResolvedValue({ error: { message: 'db unavailable' } }),
      updateByTechAndKeyword: vi.fn(),
      deleteByTechAndKeyword: vi.fn(),
    };
    const mvTechService = {
      fetchAll: vi
        .fn()
        .mockResolvedValue({ result: [], count: 10, searchParams: '' }),
    };
    const service = createService({
      aiSuggestionService,
      techKeywordService,
      mvTechService,
    });

    const result = await service.approve('suggestion-tk', undefined, 'reviewer-1');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('write_failed');
      expect(result.error.message).toContain('db unavailable');
    }
    // status transition never attempted -- suggestion remains retryable
    // (requirement 9.3)
    expect(aiSuggestionService.markApproved).not.toHaveBeenCalled();
    expect(refreshAllMaterializedViews).not.toHaveBeenCalled();
  });

  it('returns write_failed and leaves the suggestion pending when the refresh pipeline fails after a successful write (write already landed -- documented limitation, not rolled back)', async () => {
    const suggestion = {
      ...baseRecord,
      id: 'suggestion-tk',
      target_table: 'tech_keyword',
      action: 'insert',
      target_key: { tech: 'react', keyword: 'reactjs' },
      payload: { tech: 'react', keyword: 'reactjs' },
      evidence: { reasoning: 'x' },
    };
    const aiSuggestionService = {
      fetchAll: vi
        .fn()
        .mockResolvedValue({ result: [suggestion], count: 1, searchParams: '' }),
      markApproved: vi.fn(),
    };
    const techKeywordService = {
      upsert: vi.fn().mockResolvedValue({ error: null }),
      updateByTechAndKeyword: vi.fn(),
      deleteByTechAndKeyword: vi.fn(),
    };
    const mvTechService = {
      fetchAll: vi
        .fn()
        .mockResolvedValue({ result: [], count: 10, searchParams: '' }),
    };
    vi.mocked(refreshAllMaterializedViews).mockImplementation(() =>
      refreshEvents(refreshFailure()),
    );
    const service = createService({
      aiSuggestionService,
      techKeywordService,
      mvTechService,
    });

    const result = await service.approve('suggestion-tk', undefined, 'reviewer-1');

    // the write itself already landed even though approve() reports failure
    expect(techKeywordService.upsert).toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('write_failed');
      expect(result.error.message).toContain('already landed');
    }
    // status transition never attempted -- suggestion remains retryable
    // (requirement 9.3)
    expect(aiSuggestionService.markApproved).not.toHaveBeenCalled();
  });

  it('returns not_found when approving a suggestion that is already approved', async () => {
    const suggestion = {
      ...baseRecord,
      id: 'suggestion-1',
      status: 'approved',
    };
    const aiSuggestionService = {
      fetchAll: vi
        .fn()
        .mockResolvedValue({ result: [suggestion], count: 1, searchParams: '' }),
      markApproved: vi.fn(),
    };
    const service = createService({ aiSuggestionService });

    const result = await service.approve('suggestion-1', undefined, 'reviewer-1');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('not_found');
    }
    expect(aiSuggestionService.markApproved).not.toHaveBeenCalled();
  });

  it('returns not_found when approving a suggestion that is already rejected (cross-check of requirement 1.5: a rejected suggestion cannot subsequently be approved)', async () => {
    const suggestion = {
      ...baseRecord,
      id: 'suggestion-1',
      status: 'rejected',
    };
    const aiSuggestionService = {
      fetchAll: vi
        .fn()
        .mockResolvedValue({ result: [suggestion], count: 1, searchParams: '' }),
      markApproved: vi.fn(),
    };
    const service = createService({ aiSuggestionService });

    const result = await service.approve('suggestion-1', undefined, 'reviewer-1');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('not_found');
    }
    expect(aiSuggestionService.markApproved).not.toHaveBeenCalled();
  });

  it('succeeds on a retried approve() call after a prior write failure, without requiring manual data repair (requirement 9.3)', async () => {
    const suggestion = {
      ...baseRecord,
      id: 'suggestion-tk',
      target_table: 'tech_keyword',
      action: 'insert',
      target_key: { tech: 'react', keyword: 'reactjs' },
      payload: { tech: 'react', keyword: 'reactjs' },
      evidence: { reasoning: 'x' },
    };
    const approvedRecord = {
      ...suggestion,
      status: 'approved',
      reviewed_by: 'reviewer-1',
    };
    const aiSuggestionService = {
      // The suggestion is never mutated by the first (failed) attempt, so a
      // fixed `pending` row is returned for both `approve()` calls -- just
      // as the real system would leave it, since only `markApproved` (never
      // reached on the first call) transitions the status.
      fetchAll: vi
        .fn()
        .mockResolvedValue({ result: [suggestion], count: 1, searchParams: '' }),
      markApproved: vi
        .fn()
        .mockResolvedValue({ outcome: 'approved', record: approvedRecord }),
    };
    const techKeywordService = {
      upsert: vi
        .fn()
        .mockResolvedValueOnce({ error: { message: 'db unavailable' } })
        .mockResolvedValueOnce({ error: null }),
      updateByTechAndKeyword: vi.fn(),
      deleteByTechAndKeyword: vi.fn(),
    };
    const mvTechService = {
      fetchAll: vi
        .fn()
        .mockResolvedValue({ result: [], count: 10, searchParams: '' }),
    };
    const service = createService({
      aiSuggestionService,
      techKeywordService,
      mvTechService,
    });

    const firstAttempt = await service.approve(
      'suggestion-tk',
      undefined,
      'reviewer-1',
    );
    expect(firstAttempt.ok).toBe(false);
    if (!firstAttempt.ok) {
      expect(firstAttempt.error.kind).toBe('write_failed');
    }
    expect(aiSuggestionService.markApproved).not.toHaveBeenCalled();

    const secondAttempt = await service.approve(
      'suggestion-tk',
      undefined,
      'reviewer-1',
    );

    // The retry actually succeeds -- not merely "still pending" -- once the
    // underlying write problem is resolved, with no manual data repair.
    expect(techKeywordService.upsert).toHaveBeenCalledTimes(2);
    expect(secondAttempt).toEqual({ ok: true, record: approvedRecord });
    expect(aiSuggestionService.markApproved).toHaveBeenCalledTimes(1);
  });

  it('returns not_found when approving an id that does not exist', async () => {
    const aiSuggestionService = {
      fetchAll: vi
        .fn()
        .mockResolvedValue({ result: [], count: 0, searchParams: '' }),
      markApproved: vi.fn(),
    };
    const service = createService({ aiSuggestionService });

    const result = await service.approve(
      'does-not-exist',
      undefined,
      'reviewer-1',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('not_found');
    }
  });

  it('uses the reviewer-edited payload for the write and records it in resolutionNote when editedPayload is provided', async () => {
    const suggestion = {
      ...baseRecord,
      id: 'suggestion-tk',
      target_table: 'tech_keyword',
      action: 'insert',
      target_key: { tech: 'react', keyword: 'reactjs' },
      payload: { tech: 'react', keyword: 'reactjs' },
      evidence: { reasoning: 'x' },
    };
    const edited = { tech: 'react', keyword: 'react-js' };
    const approvedRecord = { ...suggestion, status: 'approved', payload: edited };
    const aiSuggestionService = {
      fetchAll: vi
        .fn()
        .mockResolvedValue({ result: [suggestion], count: 1, searchParams: '' }),
      markApproved: vi
        .fn()
        .mockResolvedValue({ outcome: 'approved', record: approvedRecord }),
    };
    const techKeywordService = {
      upsert: vi.fn().mockResolvedValue({ error: null }),
      updateByTechAndKeyword: vi.fn(),
      deleteByTechAndKeyword: vi.fn(),
    };
    const mvTechService = {
      fetchAll: vi
        .fn()
        .mockResolvedValue({ result: [], count: 10, searchParams: '' }),
    };
    const service = createService({
      aiSuggestionService,
      techKeywordService,
      mvTechService,
    });

    const result = await service.approve('suggestion-tk', edited, 'reviewer-1');

    expect(techKeywordService.upsert).toHaveBeenCalledWith([edited]);
    expect(aiSuggestionService.markApproved).toHaveBeenCalledWith(
      'suggestion-tk',
      expect.objectContaining({
        payload: edited,
        resolutionNote: expect.stringContaining('react-js'),
      }),
    );
    expect(result).toEqual({ ok: true, record: approvedRecord });
  });

  it('flags the suggestion for review when the actual count change exceeds 3x the estimated affectedCount', async () => {
    const suggestion = {
      ...baseRecord,
      id: 'suggestion-tk',
      target_table: 'tech_keyword',
      action: 'insert',
      target_key: { tech: 'react', keyword: 'reactjs' },
      payload: { tech: 'react', keyword: 'reactjs' },
      evidence: { reasoning: 'x', affectedCount: 10 },
    };
    const aiSuggestionService = {
      fetchAll: vi
        .fn()
        .mockResolvedValue({ result: [suggestion], count: 1, searchParams: '' }),
      markApproved: vi
        .fn()
        .mockResolvedValue({
          outcome: 'approved',
          record: { ...suggestion, status: 'approved' },
        }),
    };
    const techKeywordService = {
      upsert: vi.fn().mockResolvedValue({ error: null }),
      updateByTechAndKeyword: vi.fn(),
      deleteByTechAndKeyword: vi.fn(),
    };
    // |200 - 100| = 100 > 10 * 3 = 30 -> exceeds
    const mvTechService = {
      fetchAll: vi
        .fn()
        .mockResolvedValueOnce({ result: [], count: 100, searchParams: '' })
        .mockResolvedValueOnce({ result: [], count: 200, searchParams: '' }),
    };
    const service = createService({
      aiSuggestionService,
      techKeywordService,
      mvTechService,
    });

    await service.approve('suggestion-tk', undefined, 'reviewer-1');

    expect(aiSuggestionService.markApproved).toHaveBeenCalledWith(
      'suggestion-tk',
      expect.objectContaining({
        flaggedForReview: true,
        outcome: expect.objectContaining({
          exceedsExpectedMagnitude: true,
          beforeCounts: { mv_tech: 100 },
          afterCounts: { mv_tech: 200 },
        }),
      }),
    );
  });

  it('does not flag the suggestion for review when the actual count change is within 3x the estimated affectedCount', async () => {
    const suggestion = {
      ...baseRecord,
      id: 'suggestion-tk',
      target_table: 'tech_keyword',
      action: 'insert',
      target_key: { tech: 'react', keyword: 'reactjs' },
      payload: { tech: 'react', keyword: 'reactjs' },
      evidence: { reasoning: 'x', affectedCount: 10 },
    };
    const aiSuggestionService = {
      fetchAll: vi
        .fn()
        .mockResolvedValue({ result: [suggestion], count: 1, searchParams: '' }),
      markApproved: vi
        .fn()
        .mockResolvedValue({
          outcome: 'approved',
          record: { ...suggestion, status: 'approved' },
        }),
    };
    const techKeywordService = {
      upsert: vi.fn().mockResolvedValue({ error: null }),
      updateByTechAndKeyword: vi.fn(),
      deleteByTechAndKeyword: vi.fn(),
    };
    // |105 - 100| = 5 <= 10 * 3 = 30 -> within bounds
    const mvTechService = {
      fetchAll: vi
        .fn()
        .mockResolvedValueOnce({ result: [], count: 100, searchParams: '' })
        .mockResolvedValueOnce({ result: [], count: 105, searchParams: '' }),
    };
    const service = createService({
      aiSuggestionService,
      techKeywordService,
      mvTechService,
    });

    await service.approve('suggestion-tk', undefined, 'reviewer-1');

    expect(aiSuggestionService.markApproved).toHaveBeenCalledWith(
      'suggestion-tk',
      expect.objectContaining({
        flaggedForReview: false,
        outcome: expect.objectContaining({ exceedsExpectedMagnitude: false }),
      }),
    );
  });
});

describe('Service.reject', () => {
  beforeEach(() => {
    vi.mocked(refreshAllMaterializedViews).mockReset();
  });

  it('rejects a pending suggestion: transitions to rejected, records the note, and never touches any target-table write service or the mv refresh', async () => {
    const suggestion = {
      ...baseRecord,
      id: 'suggestion-tk',
      target_table: 'tech_keyword',
      status: 'pending',
    };
    const rejectedRecord = {
      ...suggestion,
      status: 'rejected',
      reviewed_by: 'reviewer-1',
      resolution_note: 'not a real alias',
    };
    const aiSuggestionService = {
      fetchAll: vi
        .fn()
        .mockResolvedValue({ result: [suggestion], count: 1, searchParams: '' }),
      markRejected: vi
        .fn()
        .mockResolvedValue({ outcome: 'rejected', record: rejectedRecord }),
    };
    const techKeywordService = {
      upsert: vi.fn(),
      updateByTechAndKeyword: vi.fn(),
      deleteByTechAndKeyword: vi.fn(),
    };
    const service = createService({ aiSuggestionService, techKeywordService });

    const result = await service.reject(
      'suggestion-tk',
      'not a real alias',
      'reviewer-1',
    );

    expect(aiSuggestionService.markRejected).toHaveBeenCalledWith(
      'suggestion-tk',
      { reviewerId: 'reviewer-1', note: 'not a real alias' },
    );
    expect(result).toEqual({ ok: true, record: rejectedRecord });
    expect(techKeywordService.upsert).not.toHaveBeenCalled();
    expect(techKeywordService.updateByTechAndKeyword).not.toHaveBeenCalled();
    expect(techKeywordService.deleteByTechAndKeyword).not.toHaveBeenCalled();
    expect(refreshAllMaterializedViews).not.toHaveBeenCalled();
  });

  it('passes null (not undefined) as the note to markRejected when no note is given', async () => {
    const suggestion = { ...baseRecord, id: 'suggestion-1', status: 'pending' };
    const aiSuggestionService = {
      fetchAll: vi
        .fn()
        .mockResolvedValue({ result: [suggestion], count: 1, searchParams: '' }),
      markRejected: vi.fn().mockResolvedValue({
        outcome: 'rejected',
        record: { ...suggestion, status: 'rejected' },
      }),
    };
    const service = createService({ aiSuggestionService });

    await service.reject('suggestion-1', undefined, 'reviewer-1');

    expect(aiSuggestionService.markRejected).toHaveBeenCalledWith(
      'suggestion-1',
      { reviewerId: 'reviewer-1', note: null },
    );
  });

  it('returns not_found without calling markRejected when the suggestion is already approved', async () => {
    const suggestion = { ...baseRecord, id: 'suggestion-1', status: 'approved' };
    const aiSuggestionService = {
      fetchAll: vi
        .fn()
        .mockResolvedValue({ result: [suggestion], count: 1, searchParams: '' }),
      markRejected: vi.fn(),
    };
    const service = createService({ aiSuggestionService });

    const result = await service.reject('suggestion-1', 'note', 'reviewer-1');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('not_found');
    }
    expect(aiSuggestionService.markRejected).not.toHaveBeenCalled();
  });

  it('returns not_found without calling markRejected when the suggestion is already rejected', async () => {
    const suggestion = { ...baseRecord, id: 'suggestion-1', status: 'rejected' };
    const aiSuggestionService = {
      fetchAll: vi
        .fn()
        .mockResolvedValue({ result: [suggestion], count: 1, searchParams: '' }),
      markRejected: vi.fn(),
    };
    const service = createService({ aiSuggestionService });

    const result = await service.reject('suggestion-1', 'note', 'reviewer-1');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('not_found');
    }
    expect(aiSuggestionService.markRejected).not.toHaveBeenCalled();
  });

  it('returns not_found when rejecting an id that does not exist', async () => {
    const aiSuggestionService = {
      fetchAll: vi
        .fn()
        .mockResolvedValue({ result: [], count: 0, searchParams: '' }),
      markRejected: vi.fn(),
    };
    const service = createService({ aiSuggestionService });

    const result = await service.reject(
      'does-not-exist',
      'note',
      'reviewer-1',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('not_found');
    }
    expect(aiSuggestionService.markRejected).not.toHaveBeenCalled();
  });

  it('reports write_failed distinctly when markRejected races to not_pending after the initial pending check passed', async () => {
    const suggestion = { ...baseRecord, id: 'suggestion-1', status: 'pending' };
    const aiSuggestionService = {
      fetchAll: vi
        .fn()
        .mockResolvedValue({ result: [suggestion], count: 1, searchParams: '' }),
      markRejected: vi.fn().mockResolvedValue({ outcome: 'not_pending' }),
    };
    const service = createService({ aiSuggestionService });

    const result = await service.reject('suggestion-1', 'note', 'reviewer-1');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('not_found');
      expect(result.error.message).toContain('concurrent');
    }
  });

  it('reports write_failed when markRejected itself errors', async () => {
    const suggestion = { ...baseRecord, id: 'suggestion-1', status: 'pending' };
    const aiSuggestionService = {
      fetchAll: vi
        .fn()
        .mockResolvedValue({ result: [suggestion], count: 1, searchParams: '' }),
      markRejected: vi.fn().mockResolvedValue({
        outcome: 'error',
        error: { message: 'db unavailable' },
      }),
    };
    const service = createService({ aiSuggestionService });

    const result = await service.reject('suggestion-1', 'note', 'reviewer-1');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('write_failed');
      expect(result.error.message).toContain('db unavailable');
    }
  });
});

describe('Service.history', () => {
  it('defaults to approved+rejected statuses and forwards targetTable/time-range filters to list', async () => {
    const expected = { result: [baseRecord], count: 1, searchParams: '' };
    const aiSuggestionService = {
      listByTargetAndStatus: vi.fn().mockResolvedValue(expected),
    };
    const service = createService({ aiSuggestionService });

    const result = await service.history({
      targetTable: 'tech_keyword',
      createdAfter: '2026-01-01T00:00:00.000Z',
      createdBefore: '2026-02-01T00:00:00.000Z',
    });

    expect(aiSuggestionService.listByTargetAndStatus).toHaveBeenCalledWith({
      status: ['approved', 'rejected'],
      targetTable: 'tech_keyword',
      createdAfter: '2026-01-01T00:00:00.000Z',
      createdBefore: '2026-02-01T00:00:00.000Z',
    });
    expect(result.result).toEqual([baseRecord]);
  });

  it('lets an explicit status filter override the approved+rejected default', async () => {
    const expected = { result: [], count: 0, searchParams: '' };
    const aiSuggestionService = {
      listByTargetAndStatus: vi.fn().mockResolvedValue(expected),
    };
    const service = createService({ aiSuggestionService });

    await service.history({ status: 'rejected' });

    expect(aiSuggestionService.listByTargetAndStatus).toHaveBeenCalledWith({
      status: 'rejected',
    });
  });
});

/**
 * Task 4.2's `generate()`/`generateStream()` orchestration is tested through
 * a test-only `Service` subclass that overrides the `protected
 * buildGenerators()` seam with fakes, instead of constructing 5 real
 * generators' worth of dependencies (`AnthropicLlmClient` +
 * `libs/data-utils` services) -- exactly the "protected/private factory
 * method the test can override" design the implementer prompt calls out.
 * Every other `Service` constructor dependency is irrelevant to this
 * behavior (the fake generators never touch them), so `createService`'s
 * empty-object defaults are used throughout.
 */
function makeFakeGenerator(
  workflow: string,
  behavior:
    | { kind: 'result'; result: any }
    | { kind: 'throw'; error: unknown },
) {
  return {
    workflow,
    // `generate()` itself must return the `AsyncGenerator` synchronously
    // (mirroring the real `async *generate()` generators), not a `Promise`
    // resolving to one -- `Service.generate()` calls `.next()` on the
    // return value directly, without awaiting the `generate()` call itself.
    generate: vi.fn().mockImplementation(async function* () {
      if (behavior.kind === 'throw') {
        throw behavior.error;
      }
      return behavior.result;
    }),
  };
}

function emptyResult(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    created: 0,
    skippedDuplicates: 0,
    skippedNoMatch: 0,
    skippedConflict: 0,
    errors: [],
    ...overrides,
  };
}

class TestableService extends Service {
  constructor(
    private readonly fakeGenerators: Record<string, any>,
    llmSettingService: any = { getValue: vi.fn().mockResolvedValue(null) },
  ) {
    super(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      llmSettingService,
    );
  }

  // `buildGenerators()` now takes the per-run `LlmClient` `generate()`
  // constructs after resolving the effective model -- irrelevant to these
  // orchestration-only tests (the fake generators never touch it), so this
  // override keeps ignoring it entirely (a valid override: fewer parameters
  // than the base signature).
  protected override buildGenerators() {
    return this.fakeGenerators as any;
  }
}

async function collect<T>(iterable: AsyncGenerator<T>): Promise<T[]> {
  const events: T[] = [];
  for await (const event of iterable) {
    events.push(event);
  }
  return events;
}

describe('Service.generate', () => {
  it('runs all 5 generators in a fixed order for workflow "all", each contributing a log+done pair', async () => {
    const order: string[] = [];
    const fakeGenerators: Record<string, any> = {};
    const counts: Record<string, number> = {
      keyword_mapping: 2,
      tech_dictionary: 1,
      tech_hierarchy: 0,
      location_mapping: 3,
      noise_detection: 1,
    };
    for (const workflow of Object.keys(counts)) {
      fakeGenerators[workflow] = makeFakeGenerator(workflow, {
        kind: 'result',
        result: emptyResult({ created: counts[workflow] }),
      });
      const originalGenerate = fakeGenerators[workflow].generate;
      // Not `async`: `generate()` must keep returning the `AsyncGenerator`
      // object synchronously, same as `makeFakeGenerator`'s doc comment.
      fakeGenerators[workflow].generate = vi.fn().mockImplementation(() => {
        order.push(workflow);
        return originalGenerate();
      });
    }
    const service = new TestableService(fakeGenerators);

    const events = await collect(service.generate('all'));

    // Every fake generator's generate() was actually invoked, in the
    // documented fixed order.
    expect(order).toEqual([
      'keyword_mapping',
      'tech_dictionary',
      'tech_hierarchy',
      'location_mapping',
      'noise_detection',
    ]);

    // Each workflow contributes a "log" (start) then a "done" (per-workflow
    // summary) event, in that same order.
    const perWorkflowEvents = events.filter(e => e.workflow !== 'all');
    expect(perWorkflowEvents.map(e => [e.type, e.workflow])).toEqual([
      ['log', 'keyword_mapping'],
      ['done', 'keyword_mapping'],
      ['log', 'tech_dictionary'],
      ['done', 'tech_dictionary'],
      ['log', 'tech_hierarchy'],
      ['done', 'tech_hierarchy'],
      ['log', 'location_mapping'],
      ['done', 'location_mapping'],
      ['log', 'noise_detection'],
      ['done', 'noise_detection'],
    ]);

    // The final overall "done" event sums every workflow's created count.
    const finalEvent = events[events.length - 1];
    expect(finalEvent).toEqual({ type: 'done', workflow: 'all', created: 7 });
  });

  it('runs only the requested workflow when a specific workflow is given, not the other 4', async () => {
    const fakeGenerators: Record<string, any> = {
      keyword_mapping: makeFakeGenerator('keyword_mapping', {
        kind: 'result',
        result: emptyResult({ created: 5 }),
      }),
      tech_dictionary: makeFakeGenerator('tech_dictionary', {
        kind: 'result',
        result: emptyResult(),
      }),
      tech_hierarchy: makeFakeGenerator('tech_hierarchy', {
        kind: 'result',
        result: emptyResult(),
      }),
      location_mapping: makeFakeGenerator('location_mapping', {
        kind: 'result',
        result: emptyResult(),
      }),
      noise_detection: makeFakeGenerator('noise_detection', {
        kind: 'result',
        result: emptyResult(),
      }),
    };
    const service = new TestableService(fakeGenerators);

    const events = await collect(service.generate('keyword_mapping'));

    expect(fakeGenerators.keyword_mapping.generate).toHaveBeenCalledTimes(1);
    expect(fakeGenerators.tech_dictionary.generate).not.toHaveBeenCalled();
    expect(fakeGenerators.tech_hierarchy.generate).not.toHaveBeenCalled();
    expect(fakeGenerators.location_mapping.generate).not.toHaveBeenCalled();
    expect(fakeGenerators.noise_detection.generate).not.toHaveBeenCalled();

    expect(events.map(e => e.workflow)).toEqual([
      'keyword_mapping',
      'keyword_mapping',
      'all',
    ]);
    expect(events[events.length - 1]).toEqual({
      type: 'done',
      workflow: 'all',
      created: 5,
    });
  });

  it('isolates a generator whose generate() promise rejects: an error event is emitted for it, but every other workflow still runs to completion', async () => {
    const order: string[] = [];
    const fakeGenerators: Record<string, any> = {
      keyword_mapping: makeFakeGenerator('keyword_mapping', {
        kind: 'result',
        result: emptyResult({ created: 1 }),
      }),
      tech_dictionary: makeFakeGenerator('tech_dictionary', {
        kind: 'throw',
        error: new Error('unexpected tech_dictionary crash'),
      }),
      tech_hierarchy: makeFakeGenerator('tech_hierarchy', {
        kind: 'result',
        result: emptyResult({ created: 2 }),
      }),
      location_mapping: makeFakeGenerator('location_mapping', {
        kind: 'result',
        result: emptyResult({ created: 3 }),
      }),
      noise_detection: makeFakeGenerator('noise_detection', {
        kind: 'result',
        result: emptyResult({ created: 4 }),
      }),
    };
    for (const workflow of Object.keys(fakeGenerators)) {
      const original = fakeGenerators[workflow].generate;
      // Not `async`: see the equivalent wrapper above.
      fakeGenerators[workflow].generate = vi.fn().mockImplementation(() => {
        order.push(workflow);
        return original();
      });
    }
    const service = new TestableService(fakeGenerators);

    const events = await collect(service.generate('all'));

    // The generator that threw did not stop the loop -- every generator's
    // generate() was still invoked exactly once, including the 3 that come
    // after the failing one.
    expect(order).toEqual([
      'keyword_mapping',
      'tech_dictionary',
      'tech_hierarchy',
      'location_mapping',
      'noise_detection',
    ]);

    // tech_dictionary contributes its "log" (start) event, then an "error"
    // event instead of a "done" event -- no third event, since the
    // orchestration loop moves straight on to the next workflow.
    const techDictionaryEvents = events.filter(e => e.workflow === 'tech_dictionary');
    expect(techDictionaryEvents).toHaveLength(2);
    expect(techDictionaryEvents[0]).toMatchObject({ type: 'log', workflow: 'tech_dictionary' });
    expect(techDictionaryEvents[1]).toMatchObject({
      type: 'error',
      workflow: 'tech_dictionary',
      message: expect.stringContaining('unexpected tech_dictionary crash'),
    });

    // The remaining 4 workflows completed normally with their own "done"
    // events (only the created counts from the successful workflows are
    // counted; the failed workflow contributes 0).
    const doneEventsByWorkflow = events.filter(
      e => e.type === 'done' && e.workflow !== 'all',
    );
    expect(doneEventsByWorkflow.map(e => [e.workflow, e.created])).toEqual([
      ['keyword_mapping', 1],
      ['tech_hierarchy', 2],
      ['location_mapping', 3],
      ['noise_detection', 4],
    ]);

    const finalEvent = events[events.length - 1];
    expect(finalEvent).toEqual({ type: 'done', workflow: 'all', created: 10 });
  });
});

describe('Service.generateStream', () => {
  it('wraps generate() into an Observable<MessageEvent> that forwards every event and completes', async () => {
    const fakeGenerators: Record<string, any> = {
      keyword_mapping: makeFakeGenerator('keyword_mapping', {
        kind: 'result',
        result: emptyResult({ created: 1 }),
      }),
      tech_dictionary: makeFakeGenerator('tech_dictionary', {
        kind: 'result',
        result: emptyResult(),
      }),
      tech_hierarchy: makeFakeGenerator('tech_hierarchy', {
        kind: 'result',
        result: emptyResult(),
      }),
      location_mapping: makeFakeGenerator('location_mapping', {
        kind: 'result',
        result: emptyResult(),
      }),
      noise_detection: makeFakeGenerator('noise_detection', {
        kind: 'result',
        result: emptyResult(),
      }),
    };
    const service = new TestableService(fakeGenerators);

    const received: any[] = [];
    let completed = false;

    await new Promise<void>((resolve, reject) => {
      service.generateStream('keyword_mapping').subscribe({
        next: message => received.push((message as any).data),
        error: reject,
        complete: () => {
          completed = true;
          resolve();
        },
      });
    });

    expect(completed).toBe(true);
    expect(received.map(e => e.type)).toEqual(['log', 'done', 'done']);
    expect(received[received.length - 1]).toEqual({
      type: 'done',
      workflow: 'all',
      created: 1,
    });
  });
});

/**
 * Model resolution: `generate()` must resolve the effective model *before*
 * constructing this run's `OpenRouterLlmClient` -- an explicit per-call
 * `options.model` wins outright (the settings table is never even
 * consulted); otherwise the stored `ai_llm_setting.default_model` value is
 * used; and if that row doesn't exist yet either, `DEFAULT_MODEL_FALLBACK`
 * is used. `OpenRouterLlmClient` itself is module-mocked above (`vi.mock('./
 * llm-client', ...)`), so these tests assert directly on the constructor
 * call args rather than needing a real `OPENROUTER_API_KEY` / network call.
 * `TestableService`'s `buildGenerators()` override still ignores whatever
 * `LlmClient` instance `generate()` passes it (irrelevant to model
 * resolution itself), so a fixed set of no-op fake generators is reused
 * across every test in this block.
 */
describe('Service.generate model resolution', () => {
  function fakeGeneratorsAllEmpty(): Record<string, any> {
    return {
      keyword_mapping: makeFakeGenerator('keyword_mapping', {
        kind: 'result',
        result: emptyResult(),
      }),
      tech_dictionary: makeFakeGenerator('tech_dictionary', {
        kind: 'result',
        result: emptyResult(),
      }),
      tech_hierarchy: makeFakeGenerator('tech_hierarchy', {
        kind: 'result',
        result: emptyResult(),
      }),
      location_mapping: makeFakeGenerator('location_mapping', {
        kind: 'result',
        result: emptyResult(),
      }),
      noise_detection: makeFakeGenerator('noise_detection', {
        kind: 'result',
        result: emptyResult(),
      }),
    };
  }

  beforeEach(() => {
    openRouterLlmClientCtor.mockClear();
  });

  it('uses the per-call model override when provided, without ever consulting the settings table', async () => {
    const llmSettingService = { getValue: vi.fn() };
    const service = new TestableService(
      fakeGeneratorsAllEmpty(),
      llmSettingService,
    );

    await collect(
      service.generate('keyword_mapping', { model: 'explicit/override-model' }),
    );

    expect(llmSettingService.getValue).not.toHaveBeenCalled();
    expect(openRouterLlmClientCtor).toHaveBeenCalledWith(
      'explicit/override-model',
    );
  });

  it('falls back to the stored ai_llm_setting default_model when no per-call override is given', async () => {
    const llmSettingService = {
      getValue: vi.fn().mockResolvedValue('stored/default-model'),
    };
    const service = new TestableService(
      fakeGeneratorsAllEmpty(),
      llmSettingService,
    );

    await collect(service.generate('keyword_mapping'));

    expect(llmSettingService.getValue).toHaveBeenCalledWith('default_model');
    expect(openRouterLlmClientCtor).toHaveBeenCalledWith(
      'stored/default-model',
    );
  });

  it('falls back to DEFAULT_MODEL_FALLBACK when the settings table has no default_model row yet', async () => {
    const llmSettingService = { getValue: vi.fn().mockResolvedValue(null) };
    const service = new TestableService(
      fakeGeneratorsAllEmpty(),
      llmSettingService,
    );

    await collect(service.generate('keyword_mapping'));

    expect(openRouterLlmClientCtor).toHaveBeenCalledWith(
      DEFAULT_MODEL_FALLBACK,
    );
  });
});

describe('Service.getLlmSettings / Service.updateLlmSettings', () => {
  it('getLlmSettings returns the stored default_model', async () => {
    const llmSettingService = {
      getValue: vi.fn().mockResolvedValue('stored/model'),
    };
    const service = createService({ llmSettingService });

    const result = await service.getLlmSettings();

    expect(llmSettingService.getValue).toHaveBeenCalledWith('default_model');
    expect(result).toEqual({ defaultModel: 'stored/model' });
  });

  it('getLlmSettings falls back to DEFAULT_MODEL_FALLBACK when no default_model row exists yet', async () => {
    const llmSettingService = { getValue: vi.fn().mockResolvedValue(null) };
    const service = createService({ llmSettingService });

    const result = await service.getLlmSettings();

    expect(result).toEqual({ defaultModel: DEFAULT_MODEL_FALLBACK });
  });

  it('updateLlmSettings writes through setValue, and a subsequent getLlmSettings reflects the change', async () => {
    let stored: string | null = null;
    const llmSettingService = {
      getValue: vi.fn().mockImplementation(async () => stored),
      setValue: vi.fn().mockImplementation(async (key: string, value: string) => {
        expect(key).toBe('default_model');
        stored = value;
      }),
    };
    const service = createService({ llmSettingService });

    await service.updateLlmSettings('new/model');
    const result = await service.getLlmSettings();

    expect(llmSettingService.setValue).toHaveBeenCalledWith(
      'default_model',
      'new/model',
    );
    expect(result).toEqual({ defaultModel: 'new/model' });
  });
});

describe('Service.getWorkflowInfo', () => {
  it('delegates to the workflow-info.ts aggregator and returns all 5 workflows unchanged', () => {
    const service = createService();

    const result = service.getWorkflowInfo();

    expect(result).toEqual(getWorkflowInfo());
    expect(result).toHaveLength(5);
  });
});
