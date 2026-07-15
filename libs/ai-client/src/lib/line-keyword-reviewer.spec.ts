import { LineKeywordAiReviewer, TOOL_NAME, INPUT_SCHEMA } from './line-keyword-reviewer';

describe('LineKeywordAiReviewer.review', () => {
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
      categories: ['frontend_framework'],
    });

    expect(result).toEqual({ ok: false, error: 'OpenRouter API request failed: timeout' });
  });

  it('returns ok:true with groups when AI identifies keywords from the line', async () => {
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
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
      categories: ['language', 'frontend_framework'],
    });

    expect(result).toEqual({
      ok: true,
      groups: [
        { category: 'language', keywords: ['typescript'] },
        { category: 'frontend_framework', keywords: ['react'] },
      ],
      reasoning: 'Both keywords appear verbatim in the line.',
    });
  });

  it('returns ok:true with empty groups when no tech keywords are found', async () => {
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          groups: [],
          reasoning: 'No technology keywords in this line.',
        },
      }),
    };
    const reviewer = new LineKeywordAiReviewer(llmClient as any);

    const result = await reviewer.review({
      lineText: '具備良好溝通能力',
      categories: ['frontend_framework'],
    });

    expect(result).toEqual({
      ok: true,
      groups: [],
      reasoning: 'No technology keywords in this line.',
    });
  });

  it('returns a single OR group when two keywords are alternatives', async () => {
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          groups: [{ category: 'backend_runtime', keywords: ['node.js', 'golang'] }],
          reasoning: '"或" indicates alternatives — placed in same OR group.',
        },
      }),
    };
    const reviewer = new LineKeywordAiReviewer(llmClient as any);

    const result = await reviewer.review({
      lineText: 'Node.js 或 Golang',
      categories: ['backend_runtime'],
    });

    expect(result).toEqual({
      ok: true,
      groups: [{ category: 'backend_runtime', keywords: ['node.js', 'golang'] }],
      reasoning: '"或" indicates alternatives — placed in same OR group.',
    });
  });

  it('returns separate AND groups when keywords are each independently required', async () => {
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
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
      categories: ['backend_runtime'],
    });

    expect(result).toEqual({
      ok: true,
      groups: [
        { category: 'backend_runtime', keywords: ['node.js'] },
        { category: 'backend_runtime', keywords: ['golang'] },
      ],
      reasoning: '"和" indicates both are required — placed in separate AND groups.',
    });
  });

  it('passes categories in the input forwarded to completeStructured', async () => {
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          groups: [{ category: 'language', keywords: ['typescript'] }],
          reasoning: 'Correct.',
        },
      }),
    };
    const reviewer = new LineKeywordAiReviewer(llmClient as any);
    const categories = ['language', 'frontend_framework'];

    await reviewer.review({
      lineText: 'TypeScript required.',
      categories,
    });

    expect(llmClient.completeStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: TOOL_NAME,
        input: expect.objectContaining({ categories }),
      }),
    );
  });

  it('requests the review_line_keywords tool with inputSchema requiring groups and reasoning', async () => {
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: { groups: [], reasoning: 'No keywords found.' },
      }),
    };
    const reviewer = new LineKeywordAiReviewer(llmClient as any);

    await reviewer.review({
      lineText: 'Nothing technical here.',
      categories: [],
    });

    expect(llmClient.completeStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'review_line_keywords',
        inputSchema: expect.objectContaining({
          type: 'object',
          required: expect.arrayContaining(['groups', 'reasoning']),
        }),
      }),
    );
  });

  it('INPUT_SCHEMA required fields are exactly ["groups", "reasoning"] with no "keywords" or "isCorrect"', () => {
    const schema = INPUT_SCHEMA as { required?: string[] };
    expect(schema.required).not.toContain('keywords');
    expect(schema.required).not.toContain('isCorrect');
    expect(schema.required).toContain('groups');
    expect(schema.required).toContain('reasoning');
  });
});
