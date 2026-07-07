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

import { refreshAllMaterializedViews } from '@codeshore/data-utils';

import { detectTechParentCycle } from './validation/cycle-check';
import { Service } from './service';

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
    expect(aiSuggestionService.markApproved).toHaveBeenCalledWith(
      'suggestion-tk',
      expect.objectContaining({
        payload: { tech: 'react', keyword: 'reactjs' },
        reviewedBy: 'reviewer-1',
        resolutionNote: null,
        flaggedForReview: false,
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
