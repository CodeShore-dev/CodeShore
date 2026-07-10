// `DynamicLlmClient.completeStructured()` constructs a fresh
// `OpenRouterLlmClient(model)` per call (see dynamic-llm-client.ts's doc
// comment). Mocking the class here lets these tests assert on the
// constructor call args and delegation directly, instead of needing a real
// `OPENROUTER_API_KEY` / network call -- same pattern
// `ai-suggestion/service.spec.ts`'s "Service.generate model resolution"
// block already uses for the identical underlying class.
const { openRouterLlmClientCtor, completeStructuredMock } = vi.hoisted(() => ({
  openRouterLlmClientCtor: vi.fn(),
  completeStructuredMock: vi.fn(),
}));
vi.mock('../ai-suggestion/llm-client', () => ({
  OpenRouterLlmClient: openRouterLlmClientCtor,
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DynamicLlmClient } from './dynamic-llm-client';

const baseRequest = {
  systemPrompt: 'sys',
  userPrompt: 'user',
  toolName: 'classify_keyword',
  inputSchema: {},
  input: {},
};

describe('DynamicLlmClient.completeStructured', () => {
  beforeEach(() => {
    openRouterLlmClientCtor.mockReset();
    completeStructuredMock.mockReset();
    openRouterLlmClientCtor.mockImplementation(() => ({
      completeStructured: completeStructuredMock,
    }));
    completeStructuredMock.mockResolvedValue({ ok: true, result: { path: 'C', reasoning: 'x' } });
  });

  it("constructs OpenRouterLlmClient with the ai_llm_setting table's stored default_model value when present", async () => {
    const llmSettingService = { getValue: vi.fn().mockResolvedValue('stored/default-model') };
    const client = new DynamicLlmClient(llmSettingService);

    const result = await client.completeStructured(baseRequest);

    expect(llmSettingService.getValue).toHaveBeenCalledWith('default_model');
    expect(openRouterLlmClientCtor).toHaveBeenCalledWith('stored/default-model');
    expect(completeStructuredMock).toHaveBeenCalledWith(baseRequest);
    expect(result).toEqual({ ok: true, result: { path: 'C', reasoning: 'x' } });
  });

  it('falls back to the hardcoded default model when ai_llm_setting has no default_model row yet', async () => {
    const llmSettingService = { getValue: vi.fn().mockResolvedValue(null) };
    const client = new DynamicLlmClient(llmSettingService);

    await client.completeStructured(baseRequest);

    expect(openRouterLlmClientCtor).toHaveBeenCalledWith('meta-llama/llama-3.3-70b-instruct:free');
  });

  it('re-resolves the model on every call rather than caching it at construction time', async () => {
    const llmSettingService = {
      getValue: vi.fn().mockResolvedValueOnce('model-a').mockResolvedValueOnce('model-b'),
    };
    const client = new DynamicLlmClient(llmSettingService);

    await client.completeStructured(baseRequest);
    await client.completeStructured(baseRequest);

    expect(llmSettingService.getValue).toHaveBeenCalledTimes(2);
    expect(openRouterLlmClientCtor).toHaveBeenNthCalledWith(1, 'model-a');
    expect(openRouterLlmClientCtor).toHaveBeenNthCalledWith(2, 'model-b');
  });

  it('propagates an ok: false result from the underlying OpenRouterLlmClient unchanged', async () => {
    completeStructuredMock.mockResolvedValue({ ok: false, error: 'OpenRouter API request failed' });
    const llmSettingService = { getValue: vi.fn().mockResolvedValue('some/model') };
    const client = new DynamicLlmClient(llmSettingService);

    const result = await client.completeStructured(baseRequest);

    expect(result).toEqual({ ok: false, error: 'OpenRouter API request failed' });
  });
});
