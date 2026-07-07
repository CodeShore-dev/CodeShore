import {
  KEYWORD_COUNT_THRESHOLD,
  KeywordMappingGenerator,
  LOW_CONFIDENCE_THRESHOLD,
} from './keyword-mapping.generator';

const techRows = [
  { id: 'react', label: 'React', category: 'frontend', tags: [], icon_slugs: [] },
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

function makeJobKeywordService(count = 0) {
  return {
    fetchAll: vi.fn().mockResolvedValue({ result: [], count, searchParams: '' }),
  };
}

function makeSuggestionCreator(
  outcome: 'created' | 'duplicate' | 'error' = 'created',
) {
  const results: Record<string, unknown> = {
    created: { outcome: 'created', record: {} },
    duplicate: {
      outcome: 'duplicate',
      targetTable: 'tech_keyword',
      workflow: 'keyword_mapping',
      targetKey: {},
    },
    error: { outcome: 'error', error: { message: 'db unavailable' } },
  };
  return {
    createSuggestion: vi.fn().mockResolvedValue(results[outcome]),
  };
}

describe('KeywordMappingGenerator.generate', () => {
  it('creates a suggestion for a confident match, with correct target_key/payload/evidence and affectedCount', async () => {
    const keywordService = makeKeywordService([{ id: 'reactjs', count: KEYWORD_COUNT_THRESHOLD }]);
    const techKeywordService = makeTechKeywordService([]);
    const techService = makeTechService();
    const jobKeywordService = makeJobKeywordService(12);
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: { matchedTechId: 'react', confidence: 0.92, reasoning: 'reactjs is an alias for React' },
      }),
    };

    const generator = new KeywordMappingGenerator(
      llmClient as any,
      keywordService as any,
      techKeywordService as any,
      techService as any,
      jobKeywordService as any,
      suggestionCreator as any,
    );

    const result = await generator.generate();

    expect(result).toEqual({ created: 1, skippedDuplicates: 0, skippedNoMatch: 0, skippedConflict: 0, errors: [] });
    expect(jobKeywordService.fetchAll).toHaveBeenCalledWith({
      where: { keywords: { cs: '{"reactjs"}' } },
    });
    expect(suggestionCreator.createSuggestion).toHaveBeenCalledWith({
      target_table: 'tech_keyword',
      workflow: 'keyword_mapping',
      action: 'insert',
      target_key: { tech: 'react', keyword: 'reactjs' },
      payload: { tech: 'react', keyword: 'reactjs' },
      evidence: {
        reasoning: 'reactjs is an alias for React',
        confidence: 0.92,
        needsVerification: false,
        affectedCount: 12,
      },
    });
    // Confirms the tech dictionary was sent as classification context.
    expect(llmClient.completeStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          keyword: 'reactjs',
          techEntries: [
            { id: 'react', label: 'React', category: 'frontend' },
            { id: 'vue', label: 'Vue', category: 'frontend' },
          ],
        },
      }),
    );
  });

  it('does not create a suggestion and increments skippedNoMatch when the LLM finds no suitable tech', async () => {
    const keywordService = makeKeywordService([{ id: 'foobar', count: KEYWORD_COUNT_THRESHOLD }]);
    const techKeywordService = makeTechKeywordService([]);
    const techService = makeTechService();
    const jobKeywordService = makeJobKeywordService(0);
    const suggestionCreator = makeSuggestionCreator();
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: { matchedTechId: null, reasoning: 'No existing tech matches "foobar"' },
      }),
    };

    const generator = new KeywordMappingGenerator(
      llmClient as any,
      keywordService as any,
      techKeywordService as any,
      techService as any,
      jobKeywordService as any,
      suggestionCreator as any,
    );

    const result = await generator.generate();

    expect(result).toEqual({ created: 0, skippedDuplicates: 0, skippedNoMatch: 1, skippedConflict: 0, errors: [] });
    expect(suggestionCreator.createSuggestion).not.toHaveBeenCalled();
  });

  it('marks needsVerification true when the LLM confidence is below the threshold', async () => {
    const keywordService = makeKeywordService([{ id: 'reactjs', count: KEYWORD_COUNT_THRESHOLD }]);
    const techKeywordService = makeTechKeywordService([]);
    const techService = makeTechService();
    const jobKeywordService = makeJobKeywordService(3);
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          matchedTechId: 'react',
          confidence: LOW_CONFIDENCE_THRESHOLD - 0.1,
          reasoning: 'weak match',
        },
      }),
    };

    const generator = new KeywordMappingGenerator(
      llmClient as any,
      keywordService as any,
      techKeywordService as any,
      techService as any,
      jobKeywordService as any,
      suggestionCreator as any,
    );

    await generator.generate();

    expect(suggestionCreator.createSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        evidence: expect.objectContaining({ needsVerification: true }),
      }),
    );
  });

  it('increments skippedDuplicates (not errors) when createSuggestion reports a duplicate', async () => {
    const keywordService = makeKeywordService([{ id: 'reactjs', count: KEYWORD_COUNT_THRESHOLD }]);
    const techKeywordService = makeTechKeywordService([]);
    const techService = makeTechService();
    const jobKeywordService = makeJobKeywordService(1);
    const suggestionCreator = makeSuggestionCreator('duplicate');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: { matchedTechId: 'react', confidence: 0.9, reasoning: 'match' },
      }),
    };

    const generator = new KeywordMappingGenerator(
      llmClient as any,
      keywordService as any,
      techKeywordService as any,
      techService as any,
      jobKeywordService as any,
      suggestionCreator as any,
    );

    const result = await generator.generate();

    expect(result).toEqual({ created: 0, skippedDuplicates: 1, skippedNoMatch: 0, skippedConflict: 0, errors: [] });
  });

  it('records an error and keeps processing remaining candidates when one LLM call fails', async () => {
    const keywordService = makeKeywordService([
      { id: 'failing-keyword', count: KEYWORD_COUNT_THRESHOLD },
      { id: 'reactjs', count: KEYWORD_COUNT_THRESHOLD },
    ]);
    const techKeywordService = makeTechKeywordService([]);
    const techService = makeTechService();
    const jobKeywordService = makeJobKeywordService(5);
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi
        .fn()
        .mockResolvedValueOnce({ ok: false, error: 'Anthropic API request failed: timeout' })
        .mockResolvedValueOnce({
          ok: true,
          result: { matchedTechId: 'react', confidence: 0.9, reasoning: 'match' },
        }),
    };

    const generator = new KeywordMappingGenerator(
      llmClient as any,
      keywordService as any,
      techKeywordService as any,
      techService as any,
      jobKeywordService as any,
      suggestionCreator as any,
    );

    const result = await generator.generate();

    expect(result.created).toBe(1);
    expect(result.errors).toEqual([
      { message: expect.stringContaining('failing-keyword') },
    ]);
    expect(llmClient.completeStructured).toHaveBeenCalledTimes(2);
    expect(suggestionCreator.createSuggestion).toHaveBeenCalledTimes(1);
  });

  it('excludes a keyword already present in tech_keyword from candidates, never calling the LLM for it', async () => {
    const keywordService = makeKeywordService([
      { id: 'reactjs', count: KEYWORD_COUNT_THRESHOLD },
      { id: 'already-mapped', count: KEYWORD_COUNT_THRESHOLD },
    ]);
    const techKeywordService = makeTechKeywordService([
      { tech: 'react', keyword: 'already-mapped' },
    ]);
    const techService = makeTechService();
    const jobKeywordService = makeJobKeywordService(2);
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: { matchedTechId: 'react', confidence: 0.9, reasoning: 'match' },
      }),
    };

    const generator = new KeywordMappingGenerator(
      llmClient as any,
      keywordService as any,
      techKeywordService as any,
      techService as any,
      jobKeywordService as any,
      suggestionCreator as any,
    );

    await generator.generate();

    expect(llmClient.completeStructured).toHaveBeenCalledTimes(1);
    expect(llmClient.completeStructured).toHaveBeenCalledWith(
      expect.objectContaining({ input: expect.objectContaining({ keyword: 'reactjs' }) }),
    );
  });

  it('excludes keywords below the count threshold from candidates', async () => {
    const keywordService = makeKeywordService([
      { id: 'rare-keyword', count: KEYWORD_COUNT_THRESHOLD - 1 },
    ]);
    const techKeywordService = makeTechKeywordService([]);
    const techService = makeTechService();
    const jobKeywordService = makeJobKeywordService(0);
    const suggestionCreator = makeSuggestionCreator();
    const llmClient = { completeStructured: vi.fn() };

    const generator = new KeywordMappingGenerator(
      llmClient as any,
      keywordService as any,
      techKeywordService as any,
      techService as any,
      jobKeywordService as any,
      suggestionCreator as any,
    );

    const result = await generator.generate();

    expect(llmClient.completeStructured).not.toHaveBeenCalled();
    expect(result).toEqual({ created: 0, skippedDuplicates: 0, skippedNoMatch: 0, skippedConflict: 0, errors: [] });
  });
});
