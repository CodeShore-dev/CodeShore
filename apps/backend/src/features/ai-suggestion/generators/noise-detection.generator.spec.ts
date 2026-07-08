import { createHash } from 'node:crypto';

import {
  JOB_DESCRIPTION_SAMPLE_SIZE,
  NoiseDetectionGenerator,
} from './noise-detection.generator';

async function drainGenerator<T, R>(gen: AsyncGenerator<T, R>): Promise<R> {
  let step = await gen.next();
  while (!step.done) {
    step = await gen.next();
  }
  return step.value;
}

function makeKeywordService(rows: Array<{ id: string; count: number }>) {
  return { fetchAll: vi.fn().mockResolvedValue({ result: rows, count: rows.length, searchParams: '' }) };
}

function makeJobService(rows: Array<{ description: string }>) {
  return { fetchAll: vi.fn().mockResolvedValue({ result: rows, count: rows.length, searchParams: '' }) };
}

function makeSuggestionCreator(
  outcomes: Array<'created' | 'duplicate' | 'error'> | 'created' | 'duplicate' | 'error' = 'created',
) {
  const results: Record<string, unknown> = {
    created: { outcome: 'created', record: {} },
    duplicate: {
      outcome: 'duplicate',
      targetTable: 'keyword_bin',
      workflow: 'noise_detection',
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

function contentHashOf(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

describe('NoiseDetectionGenerator.generate', () => {
  it('creates a keyword_bin suggestion for a flagged keyword, with affectedCount equal to its count', async () => {
    const keywordService = makeKeywordService([{ id: '獵人頭', count: 42 }]);
    const jobService = makeJobService([]);
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          result: {
            flaggedKeywords: [
              {
                id: '獵人頭',
                reasoning:
                  'Appears in job descriptions as generic recruiter/agency language, not a technology term.',
              },
            ],
          },
        })
        .mockResolvedValueOnce({ ok: true, result: { flaggedPatterns: [] } }),
    };

    const generator = new NoiseDetectionGenerator(
      llmClient as any,
      keywordService as any,
      jobService as any,
      suggestionCreator as any,
    );

    const result = await drainGenerator(generator.generate());

    expect(result).toEqual({
      created: 1,
      skippedDuplicates: 0,
      skippedNoMatch: 0,
      skippedConflict: 0,
      errors: [],
    });
    expect(suggestionCreator.createSuggestion).toHaveBeenCalledWith({
      target_table: 'keyword_bin',
      workflow: 'noise_detection',
      action: 'insert',
      target_key: { id: '獵人頭' },
      payload: { id: '獵人頭' },
      evidence: expect.objectContaining({
        affectedCount: 42,
        reasoning: expect.stringContaining('recruiter'),
      }),
    });
  });

  it('creates a job_description_bin suggestion for a flagged pattern present in 2 of 3 sampled descriptions, with the correct content_hash', async () => {
    // Non-empty so the keyword-noise sub-flow actually calls the LLM (and
    // consumes the first queued `completeStructured` response) before the
    // description-pattern sub-flow makes its own call.
    const keywordService = makeKeywordService([{ id: 'react', count: 10 }]);
    const descriptions = [
      'We are hiring. Contact hr@agency.com for details. Great team!',
      'Backend engineer wanted. Contact hr@agency.com for details.',
      'Frontend engineer role, React and TypeScript required.',
    ];
    const jobService = makeJobService(descriptions.map(description => ({ description })));
    const suggestionCreator = makeSuggestionCreator('created');
    const pattern = 'Contact hr@agency.com for details.';
    const llmClient = {
      completeStructured: vi
        .fn()
        .mockResolvedValueOnce({ ok: true, result: { flaggedKeywords: [] } })
        .mockResolvedValueOnce({
          ok: true,
          result: {
            flaggedPatterns: [
              {
                pattern,
                reasoning: 'Recruiter-agency contact boilerplate repeated across postings.',
              },
            ],
          },
        }),
    };

    const generator = new NoiseDetectionGenerator(
      llmClient as any,
      keywordService as any,
      jobService as any,
      suggestionCreator as any,
    );

    const result = await drainGenerator(generator.generate());

    expect(result).toEqual({
      created: 1,
      skippedDuplicates: 0,
      skippedNoMatch: 0,
      skippedConflict: 0,
      errors: [],
    });
    expect(suggestionCreator.createSuggestion).toHaveBeenCalledWith({
      target_table: 'job_description_bin',
      workflow: 'noise_detection',
      action: 'insert',
      target_key: { content_hash: contentHashOf(pattern) },
      payload: { content: pattern },
      evidence: expect.objectContaining({
        affectedCount: 2,
        reasoning: expect.stringContaining('Recruiter-agency'),
      }),
    });
  });

  it('increments skippedDuplicates (not errors) when createSuggestion reports a duplicate for either sub-flow', async () => {
    const keywordService = makeKeywordService([{ id: 'noise-word', count: 3 }]);
    const jobService = makeJobService([
      { description: 'Boilerplate contact block.' },
      { description: 'Another boilerplate contact block.' },
    ]);
    const suggestionCreator = makeSuggestionCreator(['duplicate', 'duplicate']);
    const llmClient = {
      completeStructured: vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          result: { flaggedKeywords: [{ id: 'noise-word', reasoning: 'generic filler word' }] },
        })
        .mockResolvedValueOnce({
          ok: true,
          result: {
            flaggedPatterns: [{ pattern: 'boilerplate contact block', reasoning: 'repeated contact boilerplate' }],
          },
        }),
    };

    const generator = new NoiseDetectionGenerator(
      llmClient as any,
      keywordService as any,
      jobService as any,
      suggestionCreator as any,
    );

    const result = await drainGenerator(generator.generate());

    expect(result).toEqual({
      created: 0,
      skippedDuplicates: 2,
      skippedNoMatch: 0,
      skippedConflict: 0,
      errors: [],
    });
  });

  it('isolates failure: keyword-noise LLM call fails but description-pattern sub-flow still creates a suggestion', async () => {
    const keywordService = makeKeywordService([{ id: 'noise-word', count: 3 }]);
    const jobService = makeJobService([
      { description: 'Boilerplate contact block appears here.' },
      { description: 'Boilerplate contact block appears here too.' },
    ]);
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi
        .fn()
        .mockResolvedValueOnce({ ok: false, error: 'Anthropic API request failed: timeout' })
        .mockResolvedValueOnce({
          ok: true,
          result: {
            flaggedPatterns: [{ pattern: 'Boilerplate contact block', reasoning: 'repeated contact boilerplate' }],
          },
        }),
    };

    const generator = new NoiseDetectionGenerator(
      llmClient as any,
      keywordService as any,
      jobService as any,
      suggestionCreator as any,
    );

    const result = await drainGenerator(generator.generate());

    expect(result.created).toBe(1);
    expect(result.errors).toEqual([{ message: expect.stringContaining('timeout') }]);
    expect(llmClient.completeStructured).toHaveBeenCalledTimes(2);
    expect(suggestionCreator.createSuggestion).toHaveBeenCalledTimes(1);
    expect(suggestionCreator.createSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({ target_table: 'job_description_bin' }),
    );
  });

  it('isolates failure: description-pattern LLM call fails but keyword-noise sub-flow still creates a suggestion', async () => {
    const keywordService = makeKeywordService([{ id: 'noise-word', count: 7 }]);
    const jobService = makeJobService([{ description: 'Some description.' }]);
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          result: { flaggedKeywords: [{ id: 'noise-word', reasoning: 'generic filler word' }] },
        })
        .mockResolvedValueOnce({ ok: false, error: 'Anthropic API request failed: rate limited' }),
    };

    const generator = new NoiseDetectionGenerator(
      llmClient as any,
      keywordService as any,
      jobService as any,
      suggestionCreator as any,
    );

    const result = await drainGenerator(generator.generate());

    expect(result.created).toBe(1);
    expect(result.errors).toEqual([{ message: expect.stringContaining('rate limited') }]);
    expect(llmClient.completeStructured).toHaveBeenCalledTimes(2);
    expect(suggestionCreator.createSuggestion).toHaveBeenCalledTimes(1);
    expect(suggestionCreator.createSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({ target_table: 'keyword_bin' }),
    );
  });

  it('bounds the job description sample to JOB_DESCRIPTION_SAMPLE_SIZE most recent descriptions', async () => {
    // Non-empty so the keyword-noise sub-flow's LLM call consumes the first
    // queued `completeStructured` response, keeping the second response
    // (asserted on below) aligned with the description-pattern sub-flow.
    const keywordService = makeKeywordService([{ id: 'react', count: 10 }]);
    const manyDescriptions = Array.from({ length: JOB_DESCRIPTION_SAMPLE_SIZE + 50 }, (_, i) => ({
      description: `description ${i}`,
    }));
    const jobService = makeJobService(manyDescriptions);
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi
        .fn()
        .mockResolvedValueOnce({ ok: true, result: { flaggedKeywords: [] } })
        .mockResolvedValueOnce({ ok: true, result: { flaggedPatterns: [] } }),
    };

    const generator = new NoiseDetectionGenerator(
      llmClient as any,
      keywordService as any,
      jobService as any,
      suggestionCreator as any,
    );

    await drainGenerator(generator.generate());

    const patternCallArgs = llmClient.completeStructured.mock.calls[1][0];
    expect(patternCallArgs.input.descriptions).toHaveLength(JOB_DESCRIPTION_SAMPLE_SIZE);
  });
});
