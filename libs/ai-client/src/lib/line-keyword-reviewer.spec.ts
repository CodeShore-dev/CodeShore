import { LineKeywordAiReviewer, TOOL_NAME } from './line-keyword-reviewer';

describe('LineKeywordAiReviewer.review', () => {
  it('returns ok:true, isCorrect:true with the candidate keywords passed through when the AI confirms the candidate set', async () => {
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          isCorrect: true,
          keywords: ['react', 'typescript'],
          reasoning: 'Both keywords appear verbatim in the line.',
        },
      }),
    };
    const reviewer = new LineKeywordAiReviewer(llmClient as any);

    const result = await reviewer.review({
      lineText: 'We use React and TypeScript.',
      candidateKeywords: ['react', 'typescript'],
    });

    expect(result).toEqual({
      ok: true,
      isCorrect: true,
      keywords: ['react', 'typescript'],
      reasoning: 'Both keywords appear verbatim in the line.',
    });
    expect(llmClient.completeStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: TOOL_NAME,
        input: { lineText: 'We use React and TypeScript.', candidateKeywords: ['react', 'typescript'] },
      }),
    );
  });

  it('returns ok:true, isCorrect:false with the AI-adjusted keyword set when the AI corrects the candidate set', async () => {
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          isCorrect: false,
          keywords: ['react'],
          reasoning: '"TypeScript" was a false positive; only React is mentioned.',
        },
      }),
    };
    const reviewer = new LineKeywordAiReviewer(llmClient as any);

    const result = await reviewer.review({
      lineText: 'We use React.',
      candidateKeywords: ['react', 'typescript'],
    });

    expect(result).toEqual({
      ok: true,
      isCorrect: false,
      keywords: ['react'],
      reasoning: '"TypeScript" was a false positive; only React is mentioned.',
    });
  });

  it('passes through the { ok: false, error } result from completeStructured without catching/throwing', async () => {
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: false,
        error: 'OpenRouter API request failed: timeout',
      }),
    };
    const reviewer = new LineKeywordAiReviewer(llmClient as any);

    const result = await reviewer.review({
      lineText: 'We use React.',
      candidateKeywords: ['react'],
    });

    expect(result).toEqual({ ok: false, error: 'OpenRouter API request failed: timeout' });
  });

  it('requests the review_line_keywords tool with an inputSchema requiring isCorrect, keywords, and reasoning', async () => {
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: { isCorrect: true, keywords: [], reasoning: 'No keywords found in this line.' },
      }),
    };
    const reviewer = new LineKeywordAiReviewer(llmClient as any);

    await reviewer.review({ lineText: 'Nothing technical here.', candidateKeywords: [] });

    expect(llmClient.completeStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'review_line_keywords',
        inputSchema: expect.objectContaining({
          type: 'object',
          required: expect.arrayContaining(['isCorrect', 'keywords', 'reasoning']),
        }),
      }),
    );
  });
});
