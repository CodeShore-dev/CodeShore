import { OpenRouter } from '@openrouter/sdk';

/**
 * A single "give me a structured judgement" request shared by every
 * suggestion generator (Requirement 2.1, 3.1, 4.1, 5.1, 6.1). The caller
 * supplies the candidate data plus what it wants judged; `LlmClient`
 * guarantees the response either matches `inputSchema`'s shape or comes
 * back as an explicit failure -- never free-form text and never a thrown
 * exception (design.md "LlmClient (Full Block)").
 */
export interface StructuredCompletionRequest<TInput> {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly toolName: string;
  /** JSON Schema, used as the tool call's `function.parameters`. */
  readonly inputSchema: Record<string, unknown>;
  readonly input: TInput;
}

export type StructuredCompletionResult<TResult> = { ok: true; result: TResult } | { ok: false; error: string };

export interface LlmClient {
  completeStructured<TResult extends Record<string, unknown>>(
    request: StructuredCompletionRequest<unknown>,
  ): Promise<StructuredCompletionResult<TResult>>;
}

/**
 * Thin wrapper around `@openrouter/sdk` that forces a single tool-call
 * response so the model's answer is guaranteed to be a structured function
 * call (or the request is treated as a failure). Intentionally single-turn
 * only: no retries, no streaming, no multi-turn conversation, no
 * LangChain/LangGraph orchestration (design.md Non-Goals).
 *
 * `model` is a required constructor parameter, not optional with an
 * env-var/hardcoded fallback: which model to use is a single, testable
 * decision made one layer up in `service.ts`'s `generate()` (per-call
 * `model` override, else the `ai_llm_setting` table's `default_model`, else
 * a hardcoded last-resort constant) -- this class stays a simple, stateless
 * "send this exact model to OpenRouter" wrapper so a fresh instance can be
 * constructed per `generate()` run without duplicating that fallback logic.
 *
 * Not a NestJS `@Injectable()` provider: this lib is framework-agnostic (see
 * design.md's `libs/ai-client` boundary note) so it can also be used from
 * `apps/crawler`, a non-NestJS execution environment. `apps/backend`'s
 * existing call sites already construct this with a manual `new
 * OpenRouterLlmClient(model)` rather than NestJS DI (it is not registered in
 * any module's `providers: [...]` array), so removing the decorator has no
 * behavioral impact there.
 */
export class OpenRouterLlmClient implements LlmClient {
  private readonly client: OpenRouter;
  private readonly model: string;

  constructor(model: string) {
    // API key is a real secret, read only from the environment (same
    // apps/backend-only convention the previous AnthropicLlmClient used) --
    // never stored in the `ai_llm_setting` settings table and never logged.
    this.client = new OpenRouter({ apiKey: process.env['OPENROUTER_API_KEY'] ?? undefined });
    this.model = model;
  }

  async completeStructured<TResult extends Record<string, unknown>>(
    request: StructuredCompletionRequest<unknown>,
  ): Promise<StructuredCompletionResult<TResult>> {
    if (!process.env['OPENROUTER_API_KEY']) {
      return {
        ok: false,
        error: 'OPENROUTER_API_KEY environment variable is not configured',
      };
    }

    // `client.chat.send(...)` is a throwing API (it internally unwraps the
    // SDK's `Result<ChatResult, Error>` via `unwrapAsync`, rejecting the
    // promise on any SDK-level error) rather than one that resolves to a
    // `{ ok, value/error }` object -- verified directly from the installed
    // `@openrouter/sdk` package's `esm/sdk/chat.js`, not assumed. Passing a
    // request with no `stream` field selects the SDK's non-streaming
    // `send()` overload (`Promise<models.ChatResult>`); `response`'s type is
    // deliberately left to be inferred from that overload resolution rather
    // than imported explicitly -- `@openrouter/sdk`'s `./models` subpath
    // export is not resolvable under this repo's `moduleResolution` setting
    // (verified: `tsc` reports TS2307 for it), and the `OpenRouter` class
    // itself carries no merged type namespace to import `ChatResult` from
    // instead (unlike `@anthropic-ai/sdk`'s `Anthropic.Message`).

    // Free-tier models occasionally return a text response instead of a tool
    // call despite toolChoice forcing one. Retry up to 2 extra times before
    // giving up so transient model non-compliance doesn't surface as a hard failure.
    const MAX_ATTEMPTS = 3;
    let lastFinishReason: string | undefined;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let response;
      try {
        response = await this.client.chat.send({
          chatRequest: {
            model: this.model,
            messages: [
              { role: 'system', content: request.systemPrompt },
              { role: 'user', content: request.userPrompt },
            ],
            tools: [
              {
                type: 'function',
                function: {
                  name: request.toolName,
                  parameters: request.inputSchema,
                },
              },
            ],
            // Forces the model to respond with exactly this tool call, so a
            // successful response is guaranteed to be schema-shaped rather
            // than free-form text.
            toolChoice: { type: 'function', function: { name: request.toolName } },
          },
        });
      } catch (error) {
        return {
          ok: false,
          error: `OpenRouter API request failed: ${toErrorMessage(error)}`,
        };
      }

      const choice = response.choices[0];
      const toolCall = choice?.message?.toolCalls?.[0];
      lastFinishReason = choice?.finishReason ?? 'unknown';

      if (!toolCall) {
        // Model returned text instead of a tool call; retry if attempts remain.
        continue;
      }

      if (toolCall.type !== 'function') {
        return {
          ok: false,
          error: `OpenRouter response used a non-function tool call type "${toolCall.type}"`,
        };
      }

      if (toolCall.function.name !== request.toolName) {
        return {
          ok: false,
          error: `OpenRouter response used unexpected tool "${toolCall.function.name}", expected "${request.toolName}"`,
        };
      }

      let parsedArguments: unknown;
      try {
        parsedArguments = parseToolArguments(toolCall.function.arguments);
      } catch (error) {
        return {
          ok: false,
          error: `OpenRouter tool call arguments were not valid JSON: ${toErrorMessage(error)}`,
        };
      }

      if (!isPlainObject(parsedArguments)) {
        return {
          ok: false,
          error: 'OpenRouter tool call arguments did not parse to a JSON object',
        };
      }

      return { ok: true, result: parsedArguments as TResult };
    }

    return {
      ok: false,
      error: `OpenRouter response did not contain a tool call after ${MAX_ATTEMPTS} attempts (finishReason: ${lastFinishReason})`,
    };
  }
}

// Some models (e.g. tencent/hy3) return tool call arguments wrapped in
// <tool_call>{"name":"...","arguments":{...}}</tool_call> XML instead of raw JSON.
function parseToolArguments(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const xmlMatch = raw.match(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/);
    if (xmlMatch) {
      const inner = JSON.parse(xmlMatch[1]); // throws if inner is also malformed
      return (inner as Record<string, unknown>)['arguments'] ?? inner;
    }
    throw new SyntaxError(`Not valid JSON: ${raw.slice(0, 80)}`);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Hardcoded last-resort model id, used only when the `ai_llm_setting` table
 * has no `default_model` row yet -- e.g. right after a fresh deploy, before
 * the migration's seed row has landed or before anyone has called `PATCH
 * ai-suggestion/llm-settings`. Everyday default-model changes should go
 * through that admin endpoint (`updateLlmSettings`), not this constant.
 */
export const DEFAULT_MODEL_FALLBACK = 'meta-llama/llama-3.3-70b-instruct:free';

/** Key this feature stores its adjustable default model under in `ai_llm_setting`. */
export const DEFAULT_MODEL_SETTING_KEY = 'default_model';
