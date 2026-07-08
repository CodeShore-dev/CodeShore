// `TechHierarchyGenerator` calls `detectTechParentCycle` directly (not
// constructor-injected), mirroring `service.spec.ts`'s existing convention
// for mocking this same module.
vi.mock('../validation/cycle-check', () => ({
  detectTechParentCycle: vi.fn(),
}));

import { detectTechParentCycle } from '../validation/cycle-check';
import { TechHierarchyGenerator } from './tech-hierarchy.generator';

async function drainGenerator<T, R>(gen: AsyncGenerator<T, R>): Promise<R> {
  let step = await gen.next();
  while (!step.done) {
    step = await gen.next();
  }
  return step.value;
}

const techRows = [
  { id: 'javascript', label: 'JavaScript', category: 'language' },
  { id: 'python', label: 'Python', category: 'language' },
  { id: 'react', label: 'React', category: 'frontend' },
  { id: 'django', label: 'Django', category: 'backend' },
];

function makeTechService(rows = techRows) {
  return { fetchAll: vi.fn().mockResolvedValue({ result: rows, count: rows.length, searchParams: '' }) };
}

function makeTechParentService(rows: Array<{ parent: string; child: string }>) {
  return { fetchAll: vi.fn().mockResolvedValue({ result: rows, count: rows.length, searchParams: '' }) };
}

function makeSuggestionCreator(
  outcome: 'created' | 'duplicate' | 'error' = 'created',
) {
  const results: Record<string, unknown> = {
    created: { outcome: 'created', record: {} },
    duplicate: {
      outcome: 'duplicate',
      targetTable: 'tech_parent',
      workflow: 'tech_hierarchy',
      targetKey: {},
    },
    error: { outcome: 'error', error: { message: 'db unavailable' } },
  };
  return {
    createSuggestion: vi.fn().mockResolvedValue(results[outcome]),
  };
}

describe('TechHierarchyGenerator.generate', () => {
  beforeEach(() => {
    vi.mocked(detectTechParentCycle).mockReset();
  });

  it('does not create a suggestion and increments skippedConflict when detectTechParentCycle reports a cycle', async () => {
    // "django" is the isolated candidate; "python" already has "javascript"
    // as an unrelated existing edge partner.
    const techService = makeTechService();
    const techParentService = makeTechParentService([
      { parent: 'javascript', child: 'react' },
    ]);
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          proposals: [
            { parent: 'django', child: 'python', reasoning: 'python belongs under django (deliberately wrong to form a cycle)' },
          ],
        },
      }),
    };
    vi.mocked(detectTechParentCycle).mockResolvedValue({
      hasCycle: true,
      conflictPath: ['python', 'django'],
    });

    const generator = new TechHierarchyGenerator(
      llmClient as any,
      techService as any,
      techParentService as any,
      suggestionCreator as any,
    );

    const result = await drainGenerator(generator.generate());

    expect(detectTechParentCycle).toHaveBeenCalledWith('django', 'python');
    expect(suggestionCreator.createSuggestion).not.toHaveBeenCalled();
    expect(result).toEqual({
      created: 0,
      skippedDuplicates: 0,
      skippedNoMatch: 0,
      skippedConflict: 1,
      errors: [],
    });
  });

  it('creates a suggestion for a valid candidate edge with correct target_key/payload and evidence.reasoning including existing parent/child context', async () => {
    const techService = makeTechService();
    const techParentService = makeTechParentService([
      { parent: 'javascript', child: 'react' },
    ]);
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          proposals: [
            { parent: 'python', child: 'django', reasoning: 'Django is a Python web framework' },
          ],
        },
      }),
    };
    vi.mocked(detectTechParentCycle).mockResolvedValue({ hasCycle: false });

    const generator = new TechHierarchyGenerator(
      llmClient as any,
      techService as any,
      techParentService as any,
      suggestionCreator as any,
    );

    const result = await drainGenerator(generator.generate());

    expect(detectTechParentCycle).toHaveBeenCalledWith('python', 'django');
    expect(result).toEqual({
      created: 1,
      skippedDuplicates: 0,
      skippedNoMatch: 0,
      skippedConflict: 0,
      errors: [],
    });
    expect(suggestionCreator.createSuggestion).toHaveBeenCalledWith({
      target_table: 'tech_parent',
      workflow: 'tech_hierarchy',
      action: 'insert',
      target_key: { parent: 'python', child: 'django' },
      payload: { parent: 'python', child: 'django' },
      evidence: {
        reasoning: expect.stringContaining('Django is a Python web framework'),
      },
    });
    const call = suggestionCreator.createSuggestion.mock.calls[0][0];
    // Requirement 4.3: existing parent/child context for both the proposed
    // parent ("python", currently has no existing edges) and the proposed
    // child ("django", currently has no existing edges) must be summarized.
    expect(call.evidence.reasoning).toContain('python');
    expect(call.evidence.reasoning).toContain('django');
    expect(call.evidence.reasoning).toContain('existing parents');
    expect(call.evidence.reasoning).toContain('existing children');
  });

  it("includes the proposed parent's and child's *existing* hierarchy relationships (not just the isolated candidate's) in evidence.reasoning", async () => {
    // "javascript" is not isolated (already a parent of "react"); "vue" is
    // the isolated candidate being proposed as a second child of "javascript".
    const rows = [
      ...techRows,
      { id: 'vue', label: 'Vue', category: 'frontend' },
    ];
    const techService = makeTechService(rows);
    const techParentService = makeTechParentService([
      { parent: 'javascript', child: 'react' },
    ]);
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          proposals: [
            { parent: 'javascript', child: 'vue', reasoning: 'Vue is a JavaScript framework' },
          ],
        },
      }),
    };
    vi.mocked(detectTechParentCycle).mockResolvedValue({ hasCycle: false });

    const generator = new TechHierarchyGenerator(
      llmClient as any,
      techService as any,
      techParentService as any,
      suggestionCreator as any,
    );

    await drainGenerator(generator.generate());

    const call = suggestionCreator.createSuggestion.mock.calls[0][0];
    // "javascript" already has "react" as an existing child -- that context
    // must show up even though "javascript" itself isn't the isolated
    // candidate in this proposal.
    expect(call.evidence.reasoning).toContain('react');
  });

  it('increments skippedDuplicates (not errors) when createSuggestion reports a duplicate', async () => {
    const techService = makeTechService();
    const techParentService = makeTechParentService([]);
    const suggestionCreator = makeSuggestionCreator('duplicate');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          proposals: [
            { parent: 'python', child: 'django', reasoning: 'Django is a Python web framework' },
          ],
        },
      }),
    };
    vi.mocked(detectTechParentCycle).mockResolvedValue({ hasCycle: false });

    const generator = new TechHierarchyGenerator(
      llmClient as any,
      techService as any,
      techParentService as any,
      suggestionCreator as any,
    );

    const result = await drainGenerator(generator.generate());

    expect(result).toEqual({
      created: 0,
      skippedDuplicates: 1,
      skippedNoMatch: 0,
      skippedConflict: 0,
      errors: [],
    });
  });

  it('records one error and creates zero suggestions, without throwing, when the single LLM call fails', async () => {
    const techService = makeTechService();
    const techParentService = makeTechParentService([]);
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: false,
        error: 'Anthropic API request failed: timeout',
      }),
    };

    const generator = new TechHierarchyGenerator(
      llmClient as any,
      techService as any,
      techParentService as any,
      suggestionCreator as any,
    );

    const result = await drainGenerator(generator.generate());

    expect(result).toEqual({
      created: 0,
      skippedDuplicates: 0,
      skippedNoMatch: 0,
      skippedConflict: 0,
      errors: [{ message: expect.stringContaining('timeout') }],
    });
    expect(suggestionCreator.createSuggestion).not.toHaveBeenCalled();
    expect(detectTechParentCycle).not.toHaveBeenCalled();
  });

  it('excludes a tech already present in tech_parent (as either parent or child) from the isolated candidates sent to the LLM', async () => {
    // "javascript" and "react" are already linked by an existing edge, so
    // neither should be listed as an isolated candidate; "python" and
    // "django" are unlinked and should both be listed.
    const techService = makeTechService();
    const techParentService = makeTechParentService([
      { parent: 'javascript', child: 'react' },
    ]);
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({ ok: true, result: { proposals: [] } }),
    };

    const generator = new TechHierarchyGenerator(
      llmClient as any,
      techService as any,
      techParentService as any,
      suggestionCreator as any,
    );

    await drainGenerator(generator.generate());

    expect(llmClient.completeStructured).toHaveBeenCalledTimes(1);
    const request = llmClient.completeStructured.mock.calls[0][0];
    expect(request.input.isolatedCandidateIds).toEqual(
      expect.arrayContaining(['python', 'django']),
    );
    expect(request.input.isolatedCandidateIds).not.toContain('javascript');
    expect(request.input.isolatedCandidateIds).not.toContain('react');
    // Full tech list and existing edges are still sent as context.
    expect(request.input.techEntries).toEqual(
      techRows.map(tech => ({ id: tech.id, label: tech.label, category: tech.category })),
    );
    expect(request.input.edges).toEqual([{ parent: 'javascript', child: 'react' }]);
  });

  it('never calls the LLM when every tech is already part of the hierarchy (no isolated candidates)', async () => {
    const rows = [
      { id: 'javascript', label: 'JavaScript', category: 'language' },
      { id: 'react', label: 'React', category: 'frontend' },
    ];
    const techService = makeTechService(rows);
    const techParentService = makeTechParentService([
      { parent: 'javascript', child: 'react' },
    ]);
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = { completeStructured: vi.fn() };

    const generator = new TechHierarchyGenerator(
      llmClient as any,
      techService as any,
      techParentService as any,
      suggestionCreator as any,
    );

    const result = await drainGenerator(generator.generate());

    expect(llmClient.completeStructured).not.toHaveBeenCalled();
    expect(result).toEqual({
      created: 0,
      skippedDuplicates: 0,
      skippedNoMatch: 0,
      skippedConflict: 0,
      errors: [],
    });
  });

  it('records an error and does not create a suggestion when detectTechParentCycle itself throws (fails closed)', async () => {
    const techService = makeTechService();
    const techParentService = makeTechParentService([]);
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          proposals: [
            { parent: 'python', child: 'django', reasoning: 'Django is a Python web framework' },
          ],
        },
      }),
    };
    vi.mocked(detectTechParentCycle).mockRejectedValue(
      new Error('detect_tech_parent_cycle RPC failed: connection reset'),
    );

    const generator = new TechHierarchyGenerator(
      llmClient as any,
      techService as any,
      techParentService as any,
      suggestionCreator as any,
    );

    const result = await drainGenerator(generator.generate());

    expect(suggestionCreator.createSuggestion).not.toHaveBeenCalled();
    expect(result.created).toBe(0);
    expect(result.skippedConflict).toBe(0);
    expect(result.errors).toEqual([
      { message: expect.stringContaining('connection reset') },
    ]);
  });
});
