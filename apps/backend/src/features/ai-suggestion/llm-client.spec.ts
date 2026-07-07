/**
 * Fakes the `@anthropic-ai/sdk` client the same way `ai_suggestion.spec.ts`
 * and `mv_company_tech.spec.ts` fake the Supabase client: no network call,
 * just a stand-in that returns the response shapes we want to exercise.
 */
const createMessageMock = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: createMessageMock },
  })),
}));

const sampleRequest = {
  systemPrompt: 'You classify keywords.',
  userPrompt: 'Classify "reactjs".',
  toolName: 'classify_keyword',
  inputSchema: {
    type: 'object',
    properties: {
      techId: { type: 'string' },
      confidence: { type: 'number' },
    },
    required: ['techId', 'confidence'],
  },
  input: { keyword: 'reactjs' },
};

describe('AnthropicLlmClient.completeStructured', () => {
  beforeEach(() => {
    createMessageMock.mockReset();
    process.env['ANTHROPIC_API_KEY'] = 'test-api-key';
  });

  it('parses a successful tool_use response into { ok: true, result }', async () => {
    createMessageMock.mockResolvedValue({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'toolu_1',
          name: 'classify_keyword',
          input: { techId: 'tech-react', confidence: 0.92 },
        },
      ],
    });
    const { AnthropicLlmClient } = await import('./llm-client');
    const client = new AnthropicLlmClient();

    const result = await client.completeStructured(sampleRequest);

    expect(result).toEqual({
      ok: true,
      result: { techId: 'tech-react', confidence: 0.92 },
    });
    // Proves tool-use was actually forced, not merely requested loosely.
    expect(createMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [
          expect.objectContaining({
            name: 'classify_keyword',
            input_schema: sampleRequest.inputSchema,
          }),
        ],
        tool_choice: { type: 'tool', name: 'classify_keyword' },
      }),
    );
  });

  it('returns { ok: false } without throwing when the response has no tool_use block', async () => {
    createMessageMock.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'I refuse to classify this.' }],
    });
    const { AnthropicLlmClient } = await import('./llm-client');
    const client = new AnthropicLlmClient();

    const result = await client.completeStructured(sampleRequest);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/tool_use/);
    }
  });

  it('returns { ok: false } without throwing when the tool_use input is not a JSON object', async () => {
    createMessageMock.mockResolvedValue({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'toolu_2',
          name: 'classify_keyword',
          input: 'not-an-object',
        },
      ],
    });
    const { AnthropicLlmClient } = await import('./llm-client');
    const client = new AnthropicLlmClient();

    const result = await client.completeStructured(sampleRequest);

    expect(result).toEqual({
      ok: false,
      error: 'Anthropic tool_use input was not a JSON object',
    });
  });

  it('returns { ok: false } without throwing when the SDK call rejects', async () => {
    createMessageMock.mockRejectedValue(new Error('connection reset'));
    const { AnthropicLlmClient } = await import('./llm-client');
    const client = new AnthropicLlmClient();

    const result = await client.completeStructured(sampleRequest);

    expect(result).toEqual({
      ok: false,
      error: 'Anthropic API request failed: connection reset',
    });
  });

  it('returns { ok: false } without throwing when ANTHROPIC_API_KEY is not configured', async () => {
    delete process.env['ANTHROPIC_API_KEY'];
    const { AnthropicLlmClient } = await import('./llm-client');
    const client = new AnthropicLlmClient();

    const result = await client.completeStructured(sampleRequest);

    expect(result.ok).toBe(false);
    expect(createMessageMock).not.toHaveBeenCalled();
  });
});
