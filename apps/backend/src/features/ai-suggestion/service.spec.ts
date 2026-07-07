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

describe('Service.list', () => {
  it('delegates to AiSuggestionService.listByTargetAndStatus with no filter and returns its result', async () => {
    const expected = { result: [baseRecord], count: 1, searchParams: '' };
    const aiSuggestionService = {
      listByTargetAndStatus: vi.fn().mockResolvedValue(expected),
    };
    const service = new Service(aiSuggestionService as any);

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
    const service = new Service(aiSuggestionService as any);

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
    const service = new Service(aiSuggestionService as any);

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
    const service = new Service(aiSuggestionService as any);

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
    const service = new Service(aiSuggestionService as any);
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
    const service = new Service(aiSuggestionService as any);

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
    const service = new Service(aiSuggestionService as any);

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
