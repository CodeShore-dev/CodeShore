/**
 * Fakes `@openrouter/sdk`'s `OpenRouter` client the same way the previous
 * `AnthropicLlmClient` suite faked `@anthropic-ai/sdk`: no network call,
 * just a stand-in for `client.chat.send(...)` that returns/rejects with the
 * response shapes we want to exercise.
 *
 * `client.chat.send(...)`'s actual runtime behavior (verified directly from
 * the installed `@openrouter/sdk` package's `esm/sdk/chat.js`, under
 * `node_modules/.pnpm`) is `async send(request, options) { return
 * unwrapAsync(chatSend(this,
 * request, options)); }` -- `unwrapAsync` (see `esm/types/fp.d.ts`) resolves
 * the underlying `Result<ChatResult, Error>` to a plain `ChatResult` on
 * success or *rejects* the promise on failure. So `client.chat.send(...)` is
 * a throwing API, not one that resolves to a `{ ok, value/error }` object --
 * this suite mocks it accordingly (`mockResolvedValue`/`mockRejectedValue`
 * directly on the `ChatResult` / `Error`, not on a `Result` wrapper).
 */
const chatSendMock = vi.fn();

vi.mock('@openrouter/sdk', () => ({
  OpenRouter: vi.fn().mockImplementation(() => ({
    chat: { send: chatSendMock },
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

function chatResultWithToolCall(overrides: Partial<{
  name: string;
  argumentsJson: string;
  type: string;
}> = {}) {
  return {
    id: 'gen-1',
    created: 0,
    model: 'some/model',
    object: 'chat.completion',
    systemFingerprint: null,
    choices: [
      {
        index: 0,
        finishReason: 'tool_calls',
        message: {
          role: 'assistant',
          toolCalls: [
            {
              id: 'call_1',
              type: overrides.type ?? 'function',
              function: {
                name: overrides.name ?? 'classify_keyword',
                arguments:
                  overrides.argumentsJson ??
                  JSON.stringify({ techId: 'tech-react', confidence: 0.92 }),
              },
            },
          ],
        },
      },
    ],
  };
}

describe('OpenRouterLlmClient.completeStructured', () => {
  beforeEach(() => {
    chatSendMock.mockReset();
    process.env['OPENROUTER_API_KEY'] = 'test-api-key';
  });

  it('parses a successful tool-call response into { ok: true, result }', async () => {
    chatSendMock.mockResolvedValue(chatResultWithToolCall());
    const { OpenRouterLlmClient } = await import('./llm-client');
    const client = new OpenRouterLlmClient('some/model');

    const result = await client.completeStructured(sampleRequest);

    expect(result).toEqual({
      ok: true,
      result: { techId: 'tech-react', confidence: 0.92 },
    });
    // Proves a tool call was actually forced via toolChoice, not merely
    // requested loosely.
    expect(chatSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        chatRequest: expect.objectContaining({
          messages: [
            { role: 'system', content: sampleRequest.systemPrompt },
            { role: 'user', content: sampleRequest.userPrompt },
          ],
          tools: [
            expect.objectContaining({
              type: 'function',
              function: expect.objectContaining({
                name: 'classify_keyword',
                parameters: sampleRequest.inputSchema,
              }),
            }),
          ],
          toolChoice: {
            type: 'function',
            function: { name: 'classify_keyword' },
          },
        }),
      }),
    );
  });

  it("passes the constructor's model through to chat.send()'s chatRequest.model field", async () => {
    chatSendMock.mockResolvedValue(chatResultWithToolCall());
    const { OpenRouterLlmClient } = await import('./llm-client');
    const client = new OpenRouterLlmClient('meta-llama/llama-3.3-70b-instruct:free');

    await client.completeStructured(sampleRequest);

    expect(chatSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        chatRequest: expect.objectContaining({
          model: 'meta-llama/llama-3.3-70b-instruct:free',
        }),
      }),
    );
  });

  it('returns { ok: false } without throwing when the response has no tool call (refusal/plain-text response)', async () => {
    chatSendMock.mockResolvedValue({
      id: 'gen-1',
      created: 0,
      model: 'some/model',
      object: 'chat.completion',
      systemFingerprint: null,
      choices: [
        {
          index: 0,
          finishReason: 'stop',
          message: { role: 'assistant', content: 'I refuse to classify this.' },
        },
      ],
    });
    const { OpenRouterLlmClient } = await import('./llm-client');
    const client = new OpenRouterLlmClient('some/model');

    const result = await client.completeStructured(sampleRequest);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/tool call/);
    }
  });

  it('returns { ok: false } without throwing when the tool call is not a function-type call', async () => {
    chatSendMock.mockResolvedValue(
      chatResultWithToolCall({ type: 'not-a-function' }),
    );
    const { OpenRouterLlmClient } = await import('./llm-client');
    const client = new OpenRouterLlmClient('some/model');

    const result = await client.completeStructured(sampleRequest);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/function/);
    }
  });

  it('returns { ok: false } without throwing when the tool call uses an unexpected tool name', async () => {
    chatSendMock.mockResolvedValue(
      chatResultWithToolCall({ name: 'wrong_tool' }),
    );
    const { OpenRouterLlmClient } = await import('./llm-client');
    const client = new OpenRouterLlmClient('some/model');

    const result = await client.completeStructured(sampleRequest);

    expect(result).toEqual({
      ok: false,
      error:
        'OpenRouter response used unexpected tool "wrong_tool", expected "classify_keyword"',
    });
  });

  it('returns { ok: false } without throwing when the tool call arguments are not valid JSON', async () => {
    chatSendMock.mockResolvedValue(
      chatResultWithToolCall({ argumentsJson: 'not-json{' }),
    );
    const { OpenRouterLlmClient } = await import('./llm-client');
    const client = new OpenRouterLlmClient('some/model');

    const result = await client.completeStructured(sampleRequest);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/JSON/);
    }
  });

  it('returns { ok: false } without throwing when the tool call arguments parse to a non-object', async () => {
    chatSendMock.mockResolvedValue(
      chatResultWithToolCall({ argumentsJson: '"not-an-object"' }),
    );
    const { OpenRouterLlmClient } = await import('./llm-client');
    const client = new OpenRouterLlmClient('some/model');

    const result = await client.completeStructured(sampleRequest);

    expect(result).toEqual({
      ok: false,
      error: 'OpenRouter tool call arguments did not parse to a JSON object',
    });
  });

  it('returns { ok: false } without throwing when client.chat.send(...) rejects', async () => {
    chatSendMock.mockRejectedValue(new Error('connection reset'));
    const { OpenRouterLlmClient } = await import('./llm-client');
    const client = new OpenRouterLlmClient('some/model');

    const result = await client.completeStructured(sampleRequest);

    expect(result).toEqual({
      ok: false,
      error: 'OpenRouter API request failed: connection reset',
    });
  });

  it('returns { ok: false } without throwing when OPENROUTER_API_KEY is not configured', async () => {
    delete process.env['OPENROUTER_API_KEY'];
    const { OpenRouterLlmClient } = await import('./llm-client');
    const client = new OpenRouterLlmClient('some/model');

    const result = await client.completeStructured(sampleRequest);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/OPENROUTER_API_KEY/);
    }
    expect(chatSendMock).not.toHaveBeenCalled();
  });
});
