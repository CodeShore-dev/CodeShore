import {
  KEYWORD_COUNT_THRESHOLD,
  SIMILARITY_THRESHOLD,
  TechDictionaryGenerator,
} from './tech-dictionary.generator';

const techRows = [
  { id: 'react', label: 'React', category: 'frontend', tags: ['ui'], icon_slugs: [] },
  { id: 'vue', label: 'Vue', category: 'frontend', tags: [], icon_slugs: [] },
];

function makeKeywordService(rows: Array<{ id: string; count: number }>) {
  return { fetchAll: vi.fn().mockResolvedValue({ result: rows, count: rows.length, searchParams: '' }) };
}

function makeTechKeywordService(rows: Array<{ tech: string; keyword: string }>) {
  return { fetchAll: vi.fn().mockResolvedValue({ result: rows, count: rows.length, searchParams: '' }) };
}

function makeTechService(rows = techRows) {
  return { fetchAll: vi.fn().mockResolvedValue({ result: rows, count: rows.length, searchParams: '' }) };
}

function makeSuggestionCreator(
  outcomes: Array<'created' | 'duplicate' | 'error'> | 'created' | 'duplicate' | 'error' = 'created',
) {
  const results: Record<string, unknown> = {
    created: { outcome: 'created', record: {} },
    duplicate: {
      outcome: 'duplicate',
      targetTable: 'tech',
      workflow: 'tech_dictionary',
      targetKey: {},
    },
    error: { outcome: 'error', error: { message: 'db unavailable' } },
  };

  const createSuggestion = vi.fn();
  if (Array.isArray(outcomes)) {
    outcomes.forEach(outcome => createSuggestion.mockResolvedValueOnce(results[outcome]));
  } else {
    createSuggestion.mockResolvedValue(results[outcomes]);
  }

  return { createSuggestion };
}

describe('TechDictionaryGenerator.generate', () => {
  it('creates a suggestion for a new tech entry with no similar existing items, evidence.similarItems is empty array', async () => {
    const keywordService = makeKeywordService([{ id: 'solidjs', count: KEYWORD_COUNT_THRESHOLD }]);
    const techKeywordService = makeTechKeywordService([]);
    const techService = makeTechService();
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          newEntries: [
            {
              id: 'solidjs',
              label: 'SolidJS',
              category: 'frontend',
              tags: ['reactive'],
              keywords: ['solidjs'],
              reasoning: 'A reactive frontend framework distinct from React/Vue',
            },
          ],
          updates: [],
        },
      }),
    };
    const findSimilarTechFn = vi.fn().mockResolvedValue([]);

    const generator = new TechDictionaryGenerator(
      llmClient as any,
      keywordService as any,
      techKeywordService as any,
      techService as any,
      suggestionCreator as any,
      findSimilarTechFn,
    );

    const result = await generator.generate();

    expect(result).toEqual({ created: 1, skippedDuplicates: 0, skippedNoMatch: 0, errors: [] });
    expect(findSimilarTechFn).toHaveBeenCalledWith('SolidJS', SIMILARITY_THRESHOLD);
    expect(suggestionCreator.createSuggestion).toHaveBeenCalledWith({
      target_table: 'tech',
      workflow: 'tech_dictionary',
      action: 'insert',
      target_key: { id: 'solidjs' },
      payload: { id: 'solidjs', category: 'frontend', label: 'SolidJS', tags: ['reactive'] },
      evidence: {
        reasoning: 'A reactive frontend framework distinct from React/Vue',
        similarItems: [],
      },
    });
  });

  it('still creates the suggestion (not blocked) when the new entry is similar to an existing tech, and includes the match in evidence.similarItems', async () => {
    const keywordService = makeKeywordService([{ id: 'reactjs2', count: KEYWORD_COUNT_THRESHOLD }]);
    const techKeywordService = makeTechKeywordService([]);
    const techService = makeTechService();
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          newEntries: [
            {
              id: 'reactjs2',
              label: 'React.js',
              category: 'frontend',
              tags: [],
              keywords: ['reactjs2'],
              reasoning: 'Looks like an alternate label for React',
            },
          ],
          updates: [],
        },
      }),
    };
    const findSimilarTechFn = vi
      .fn()
      .mockResolvedValue([{ id: 'react', label: 'React', score: 0.8 }]);

    const generator = new TechDictionaryGenerator(
      llmClient as any,
      keywordService as any,
      techKeywordService as any,
      techService as any,
      suggestionCreator as any,
      findSimilarTechFn,
    );

    const result = await generator.generate();

    expect(result.created).toBe(1);
    expect(suggestionCreator.createSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'insert',
        evidence: expect.objectContaining({
          similarItems: [{ id: 'react', label: 'React', score: 0.8 }],
        }),
      }),
    );
  });

  it('creates an update suggestion for an existing tech, action="update", payload excludes unrelated fields, only touches tech target_table', async () => {
    const keywordService = makeKeywordService([{ id: 'vuejs', count: KEYWORD_COUNT_THRESHOLD }]);
    const techKeywordService = makeTechKeywordService([]);
    const techService = makeTechService();
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          newEntries: [],
          updates: [
            {
              techId: 'vue',
              category: 'frontend-framework',
              tags: ['reactive', 'spa'],
              reasoning: 'Existing tags are too sparse given how "vue" keywords are used',
            },
          ],
        },
      }),
    };
    const findSimilarTechFn = vi.fn();

    const generator = new TechDictionaryGenerator(
      llmClient as any,
      keywordService as any,
      techKeywordService as any,
      techService as any,
      suggestionCreator as any,
      findSimilarTechFn,
    );

    const result = await generator.generate();

    expect(result).toEqual({ created: 1, skippedDuplicates: 0, skippedNoMatch: 0, errors: [] });
    expect(findSimilarTechFn).not.toHaveBeenCalled();
    expect(suggestionCreator.createSuggestion).toHaveBeenCalledWith({
      target_table: 'tech',
      workflow: 'tech_dictionary',
      action: 'update',
      target_key: { id: 'vue' },
      payload: { id: 'vue', category: 'frontend-framework', tags: ['reactive', 'spa'] },
      evidence: {
        reasoning: 'Existing tags are too sparse given how "vue" keywords are used',
      },
    });
    const call = suggestionCreator.createSuggestion.mock.calls[0][0];
    expect(call.payload).not.toHaveProperty('icon_slugs');
    expect(call.payload).not.toHaveProperty('keyword');
    expect(call.payload).not.toHaveProperty('parent');
    expect(call.payload).not.toHaveProperty('child');
  });

  it('includes icon_slugs in the update payload only when the LLM specifically proposes changing it', async () => {
    const keywordService = makeKeywordService([{ id: 'vuejs', count: KEYWORD_COUNT_THRESHOLD }]);
    const techKeywordService = makeTechKeywordService([]);
    const techService = makeTechService();
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          newEntries: [],
          updates: [
            {
              techId: 'vue',
              iconSlugs: ['vuedotjs'],
              reasoning: 'Missing icon slug',
            },
          ],
        },
      }),
    };

    const generator = new TechDictionaryGenerator(
      llmClient as any,
      keywordService as any,
      techKeywordService as any,
      techService as any,
      suggestionCreator as any,
      vi.fn(),
    );

    await generator.generate();

    expect(suggestionCreator.createSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { id: 'vue', icon_slugs: ['vuedotjs'] },
      }),
    );
  });

  it('increments skippedDuplicates (not errors) when createSuggestion reports a duplicate', async () => {
    const keywordService = makeKeywordService([{ id: 'solidjs', count: KEYWORD_COUNT_THRESHOLD }]);
    const techKeywordService = makeTechKeywordService([]);
    const techService = makeTechService();
    const suggestionCreator = makeSuggestionCreator('duplicate');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          newEntries: [
            { id: 'solidjs', label: 'SolidJS', category: 'frontend', tags: [], keywords: ['solidjs'] },
          ],
          updates: [],
        },
      }),
    };
    const findSimilarTechFn = vi.fn().mockResolvedValue([]);

    const generator = new TechDictionaryGenerator(
      llmClient as any,
      keywordService as any,
      techKeywordService as any,
      techService as any,
      suggestionCreator as any,
      findSimilarTechFn,
    );

    const result = await generator.generate();

    expect(result).toEqual({ created: 0, skippedDuplicates: 1, skippedNoMatch: 0, errors: [] });
  });

  it('records one error and creates zero suggestions, without throwing, when the single LLM call fails', async () => {
    const keywordService = makeKeywordService([{ id: 'solidjs', count: KEYWORD_COUNT_THRESHOLD }]);
    const techKeywordService = makeTechKeywordService([]);
    const techService = makeTechService();
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: false,
        error: 'Anthropic API request failed: timeout',
      }),
    };
    const findSimilarTechFn = vi.fn();

    const generator = new TechDictionaryGenerator(
      llmClient as any,
      keywordService as any,
      techKeywordService as any,
      techService as any,
      suggestionCreator as any,
      findSimilarTechFn,
    );

    const result = await generator.generate();

    expect(result).toEqual({
      created: 0,
      skippedDuplicates: 0,
      skippedNoMatch: 0,
      errors: [{ message: expect.stringContaining('timeout') }],
    });
    expect(suggestionCreator.createSuggestion).not.toHaveBeenCalled();
    expect(findSimilarTechFn).not.toHaveBeenCalled();
  });

  it('excludes keywords already present in tech_keyword or below the count threshold, never calling the LLM when there are no candidates', async () => {
    const keywordService = makeKeywordService([
      { id: 'already-mapped', count: KEYWORD_COUNT_THRESHOLD },
      { id: 'rare-keyword', count: KEYWORD_COUNT_THRESHOLD - 1 },
    ]);
    const techKeywordService = makeTechKeywordService([
      { tech: 'react', keyword: 'already-mapped' },
    ]);
    const techService = makeTechService();
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = { completeStructured: vi.fn() };

    const generator = new TechDictionaryGenerator(
      llmClient as any,
      keywordService as any,
      techKeywordService as any,
      techService as any,
      suggestionCreator as any,
      vi.fn(),
    );

    const result = await generator.generate();

    expect(llmClient.completeStructured).not.toHaveBeenCalled();
    expect(result).toEqual({ created: 0, skippedDuplicates: 0, skippedNoMatch: 0, errors: [] });
  });

  it('sends both candidate keywords and full tech dictionary as LLM input context', async () => {
    const keywordService = makeKeywordService([{ id: 'solidjs', count: KEYWORD_COUNT_THRESHOLD }]);
    const techKeywordService = makeTechKeywordService([]);
    const techService = makeTechService();
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({ ok: true, result: { newEntries: [], updates: [] } }),
    };

    const generator = new TechDictionaryGenerator(
      llmClient as any,
      keywordService as any,
      techKeywordService as any,
      techService as any,
      suggestionCreator as any,
      vi.fn(),
    );

    await generator.generate();

    expect(llmClient.completeStructured).toHaveBeenCalledTimes(1);
    expect(llmClient.completeStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          candidateKeywords: ['solidjs'],
          techEntries: [
            { id: 'react', label: 'React', category: 'frontend', tags: ['ui'] },
            { id: 'vue', label: 'Vue', category: 'frontend', tags: [] },
          ],
        },
      }),
    );
  });
});
