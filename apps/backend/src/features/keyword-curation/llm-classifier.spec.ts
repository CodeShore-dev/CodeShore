import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

import type { TechOption } from './graph.types';
import { CurationLlmClassifier } from './llm-classifier';

const allTechs: TechOption[] = [
  { id: 'react', label: 'React', category: 'frontend' },
  { id: 'javascript', label: 'JavaScript', category: 'language' },
  { id: 'typescript', label: 'TypeScript', category: 'language' },
];

function makeLlmClient(resolvedValue: unknown) {
  return { completeStructured: vi.fn().mockResolvedValue(resolvedValue) };
}

describe('CurationLlmClassifier.classify', () => {
  it('returns a path A AiRecommendation with matchedTech resolved from allTechs (requirement 3.2)', async () => {
    const llmClient = makeLlmClient({
      ok: true,
      result: {
        path: 'A',
        matchedTechId: 'react',
        confidence: 0.92,
        reasoning: '"reactjs" is a common alias for React.',
      },
    });
    const classifier = new CurationLlmClassifier(llmClient as any);

    const recommendation = await classifier.classify('reactjs', 14, allTechs);

    expect(recommendation).toEqual({
      path: 'A',
      matchedTech: { id: 'react', label: 'React', category: 'frontend' },
      confidence: 0.92,
      reasoning: '"reactjs" is a common alias for React.',
      affectedJobCount: 14,
    });
    expect(llmClient.completeStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'classify_keyword',
        systemPrompt: expect.any(String),
        userPrompt: expect.any(String),
        inputSchema: expect.objectContaining({
          type: 'object',
          required: ['path', 'reasoning'],
        }),
      }),
    );
  });

  it('still produces a valid path A AiRecommendation when confidence is low, carrying confidence through unchanged (requirement 3.2)', async () => {
    const llmClient = makeLlmClient({
      ok: true,
      result: {
        path: 'A',
        matchedTechId: 'typescript',
        confidence: 0.18,
        reasoning: 'Weak signal, but closest existing entry.',
      },
    });
    const classifier = new CurationLlmClassifier(llmClient as any);

    const recommendation = await classifier.classify('ts-ish', 3, allTechs);

    expect(recommendation).toEqual({
      path: 'A',
      matchedTech: { id: 'typescript', label: 'TypeScript', category: 'language' },
      confidence: 0.18,
      reasoning: 'Weak signal, but closest existing entry.',
      affectedJobCount: 3,
    });
  });

  it('returns a path B AiRecommendation with suggestedTech and resolved suggestedEdges (requirement 3.3, 6.3)', async () => {
    const llmClient = makeLlmClient({
      ok: true,
      result: {
        path: 'B',
        suggestedId: 'nextjs',
        suggestedLabel: 'Next.js',
        suggestedCategory: 'frontend',
        suggestedTags: ['react-framework', 'ssr'],
        suggestedEdges: [
          { type: 'parent', techId: 'react', reasoning: 'Next.js is built on top of React.' },
        ],
        reasoning: 'No existing entry covers Next.js specifically.',
      },
    });
    const classifier = new CurationLlmClassifier(llmClient as any);

    const recommendation = await classifier.classify('nextjs', 7, allTechs);

    expect(recommendation).toEqual({
      path: 'B',
      suggestedTech: {
        id: 'nextjs',
        label: 'Next.js',
        category: 'frontend',
        tags: ['react-framework', 'ssr'],
        iconSlugs: [],
      },
      suggestedEdges: [
        { type: 'parent', techId: 'react', techLabel: 'React', reasoning: 'Next.js is built on top of React.' },
      ],
      reasoning: 'No existing entry covers Next.js specifically.',
      affectedJobCount: 7,
    });
  });

  it('returns a path B AiRecommendation with an empty suggestedEdges array when the LLM suggests none', async () => {
    const llmClient = makeLlmClient({
      ok: true,
      result: {
        path: 'B',
        suggestedId: 'bun',
        suggestedLabel: 'Bun',
        suggestedCategory: 'runtime',
        reasoning: 'Distinct JS runtime, no clear parent/child relation.',
      },
    });
    const classifier = new CurationLlmClassifier(llmClient as any);

    const recommendation = await classifier.classify('bun', 2, allTechs);

    expect(recommendation).toEqual({
      path: 'B',
      suggestedTech: {
        id: 'bun',
        label: 'Bun',
        category: 'runtime',
        tags: [],
        iconSlugs: [],
      },
      suggestedEdges: [],
      reasoning: 'Distinct JS runtime, no clear parent/child relation.',
      affectedJobCount: 2,
    });
  });

  it('returns a path C AiRecommendation with reasoning (requirement 3.4)', async () => {
    const llmClient = makeLlmClient({
      ok: true,
      result: {
        path: 'C',
        reasoning: '"asdf123" does not refer to any known technology.',
      },
    });
    const classifier = new CurationLlmClassifier(llmClient as any);

    const recommendation = await classifier.classify('asdf123', 1, allTechs);

    expect(recommendation).toEqual({
      path: 'C',
      reasoning: '"asdf123" does not refer to any known technology.',
      affectedJobCount: 1,
    });
  });

  it('returns { path: "ai_failed", error } without throwing when the LlmClient resolves ok: false (requirement 3.5, 9.2)', async () => {
    const llmClient = makeLlmClient({ ok: false, error: 'OpenRouter API request failed: timeout' });
    const classifier = new CurationLlmClassifier(llmClient as any);

    const recommendation = await classifier.classify('flaky-keyword', 5, allTechs);

    expect(recommendation).toEqual({
      path: 'ai_failed',
      error: 'OpenRouter API request failed: timeout',
    });
  });

  it('returns { path: "ai_failed", error } without throwing when the LlmClient throws (requirement 3.5, 9.2)', async () => {
    const llmClient = { completeStructured: vi.fn().mockRejectedValue(new Error('network unreachable')) };
    const classifier = new CurationLlmClassifier(llmClient as any);

    await expect(classifier.classify('crashy-keyword', 9, allTechs)).resolves.toEqual({
      path: 'ai_failed',
      error: expect.stringContaining('network unreachable'),
    });
  });

  it('returns { path: "ai_failed", error } for an unexpected/malformed path value instead of guessing a variant', async () => {
    const llmClient = makeLlmClient({
      ok: true,
      result: { path: 'D', reasoning: 'unexpected' },
    });
    const classifier = new CurationLlmClassifier(llmClient as any);

    const recommendation = await classifier.classify('weird-keyword', 0, allTechs);

    expect(recommendation.path).toBe('ai_failed');
    expect((recommendation as { error: string }).error).toEqual(expect.any(String));
  });

  it('returns { path: "ai_failed", error } for path A when matchedTechId does not resolve against allTechs', async () => {
    const llmClient = makeLlmClient({
      ok: true,
      result: { path: 'A', matchedTechId: 'nonexistent-tech', confidence: 0.8, reasoning: 'bad match id' },
    });
    const classifier = new CurationLlmClassifier(llmClient as any);

    const recommendation = await classifier.classify('bogus', 0, allTechs);

    expect(recommendation.path).toBe('ai_failed');
  });

  it('returns { path: "ai_failed", error } for path B when a suggestedEdges techId does not resolve against allTechs', async () => {
    const llmClient = makeLlmClient({
      ok: true,
      result: {
        path: 'B',
        suggestedId: 'foo',
        suggestedLabel: 'Foo',
        suggestedCategory: 'misc',
        suggestedEdges: [{ type: 'child', techId: 'does-not-exist', reasoning: 'x' }],
        reasoning: 'y',
      },
    });
    const classifier = new CurationLlmClassifier(llmClient as any);

    const recommendation = await classifier.classify('foo-kw', 0, allTechs);

    expect(recommendation.path).toBe('ai_failed');
  });
});
