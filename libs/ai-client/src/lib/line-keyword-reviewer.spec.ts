import { LineKeywordAiReviewer, TOOL_NAME, INPUT_SCHEMA } from './line-keyword-reviewer';

describe('LineKeywordAiReviewer.review (legacy — isCorrect + keywords)', () => {
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
      keywordCategoryMap: {},
    });

    expect(result).toEqual({ ok: false, error: 'OpenRouter API request failed: timeout' });
  });
});

describe('LineKeywordAiReviewer.review (grouped output)', () => {
  it('returns ok:true with groups when AI confirms the candidate set (isCorrect:true)', async () => {
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          isCorrect: true,
          groups: [
            { category: 'language', keywords: ['typescript'] },
            { category: 'frontend_framework', keywords: ['react'] },
          ],
          reasoning: 'Both keywords appear verbatim in the line.',
        },
      }),
    };
    const reviewer = new LineKeywordAiReviewer(llmClient as any);

    const result = await reviewer.review({
      lineText: 'We use TypeScript and React.',
      candidateKeywords: ['typescript', 'react'],
      keywordCategoryMap: { typescript: 'language', react: 'frontend_framework' },
    });

    expect(result).toEqual({
      ok: true,
      isCorrect: true,
      groups: [
        { category: 'language', keywords: ['typescript'] },
        { category: 'frontend_framework', keywords: ['react'] },
      ],
      reasoning: 'Both keywords appear verbatim in the line.',
    });
  });

  it('returns ok:true with corrected groups when AI adjusts the candidate set (isCorrect:false)', async () => {
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          isCorrect: false,
          groups: [{ category: 'frontend_framework', keywords: ['react'] }],
          reasoning: '"TypeScript" was a false positive; only React is mentioned.',
        },
      }),
    };
    const reviewer = new LineKeywordAiReviewer(llmClient as any);

    const result = await reviewer.review({
      lineText: 'We use React.',
      candidateKeywords: ['react', 'typescript'],
      keywordCategoryMap: { react: 'frontend_framework', typescript: 'language' },
    });

    expect(result).toEqual({
      ok: true,
      isCorrect: false,
      groups: [{ category: 'frontend_framework', keywords: ['react'] }],
      reasoning: '"TypeScript" was a false positive; only React is mentioned.',
    });
  });

  it('returns a single OR group when two keywords are alternatives', async () => {
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          isCorrect: true,
          groups: [{ category: 'backend_runtime', keywords: ['node.js', 'golang'] }],
          reasoning: '"或" indicates alternatives — placed in same OR group.',
        },
      }),
    };
    const reviewer = new LineKeywordAiReviewer(llmClient as any);

    const result = await reviewer.review({
      lineText: 'Node.js 或 Golang',
      candidateKeywords: ['node.js', 'golang'],
      keywordCategoryMap: { 'node.js': 'backend_runtime', golang: 'backend_runtime' },
    });

    expect(result).toEqual({
      ok: true,
      isCorrect: true,
      groups: [{ category: 'backend_runtime', keywords: ['node.js', 'golang'] }],
      reasoning: '"或" indicates alternatives — placed in same OR group.',
    });
  });

  it('returns separate AND groups when keywords are each independently required', async () => {
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          isCorrect: true,
          groups: [
            { category: 'backend_runtime', keywords: ['node.js'] },
            { category: 'backend_runtime', keywords: ['golang'] },
          ],
          reasoning: '"和" indicates both are required — placed in separate AND groups.',
        },
      }),
    };
    const reviewer = new LineKeywordAiReviewer(llmClient as any);

    const result = await reviewer.review({
      lineText: 'Node.js 和 Golang',
      candidateKeywords: ['node.js', 'golang'],
      keywordCategoryMap: { 'node.js': 'backend_runtime', golang: 'backend_runtime' },
    });

    expect(result).toEqual({
      ok: true,
      isCorrect: true,
      groups: [
        { category: 'backend_runtime', keywords: ['node.js'] },
        { category: 'backend_runtime', keywords: ['golang'] },
      ],
      reasoning: '"和" indicates both are required — placed in separate AND groups.',
    });
  });

  it('passes keywordCategoryMap in the input forwarded to completeStructured', async () => {
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          isCorrect: true,
          groups: [{ category: 'language', keywords: ['typescript'] }],
          reasoning: 'Correct.',
        },
      }),
    };
    const reviewer = new LineKeywordAiReviewer(llmClient as any);
    const keywordCategoryMap = { typescript: 'language' };

    await reviewer.review({
      lineText: 'TypeScript required.',
      candidateKeywords: ['typescript'],
      keywordCategoryMap,
    });

    expect(llmClient.completeStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: TOOL_NAME,
        input: expect.objectContaining({ keywordCategoryMap }),
      }),
    );
  });

  it('requests the review_line_keywords tool with inputSchema requiring isCorrect, groups, and reasoning', async () => {
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          isCorrect: true,
          groups: [],
          reasoning: 'No keywords found in this line.',
        },
      }),
    };
    const reviewer = new LineKeywordAiReviewer(llmClient as any);

    await reviewer.review({
      lineText: 'Nothing technical here.',
      candidateKeywords: [],
      keywordCategoryMap: {},
    });

    expect(llmClient.completeStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'review_line_keywords',
        inputSchema: expect.objectContaining({
          type: 'object',
          required: expect.arrayContaining(['isCorrect', 'groups', 'reasoning']),
        }),
      }),
    );
  });

  it('INPUT_SCHEMA does not contain "keywords" as a top-level required field', () => {
    const schema = INPUT_SCHEMA as { required?: string[] };
    expect(schema.required).not.toContain('keywords');
    expect(schema.required).toContain('groups');
  });
});
