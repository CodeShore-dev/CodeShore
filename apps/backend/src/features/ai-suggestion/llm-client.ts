import Anthropic from '@anthropic-ai/sdk';
import { Injectable } from '@nestjs/common';

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
  /** JSON Schema, used as Anthropic's tool_use `input_schema`. */
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
 * Fallback model when `ANTHROPIC_MODEL` is not configured. Model/vendor
 * selection itself is out of this spec's boundary (design.md Non-Goals);
 * this is only a default so the client is usable without extra setup.
 */
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';
const MAX_TOKENS = 4096;

/**
 * Thin wrapper around `@anthropic-ai/sdk` that forces a single tool-use
 * response so the model's answer is guaranteed to be a structured
 * `tool_use` content block (or the request is treated as a failure).
 * Intentionally single-turn only: no retries, no streaming, no multi-turn
 * conversation, no LangChain/LangGraph orchestration (design.md Non-Goals).
 */
@Injectable()
export class AnthropicLlmClient implements LlmClient {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(model?: string) {
    // API key is read from the existing server-side environment variable
    // convention (see apps/backend/src/features/auth/adminEmails.ts) and
    // only ever lives in apps/backend, never in libs/data-utils. It is
    // never logged or hardcoded.
    this.client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] ?? undefined });
    this.model = model ?? process.env['ANTHROPIC_MODEL'] ?? DEFAULT_MODEL;
  }

  async completeStructured<TResult extends Record<string, unknown>>(
    request: StructuredCompletionRequest<unknown>,
  ): Promise<StructuredCompletionResult<TResult>> {
    if (!process.env['ANTHROPIC_API_KEY']) {
      return {
        ok: false,
        error: 'ANTHROPIC_API_KEY environment variable is not configured',
      };
    }

    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: MAX_TOKENS,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.userPrompt }],
        tools: [
          {
            name: request.toolName,
            input_schema: request.inputSchema as Anthropic.Tool.InputSchema,
          },
        ],
        // Forces the model to respond with exactly this tool call, so a
        // successful response is guaranteed to be schema-shaped rather
        // than free-form text.
        tool_choice: { type: 'tool', name: request.toolName },
      });
    } catch (error) {
      return {
        ok: false,
        error: `Anthropic API request failed: ${toErrorMessage(error)}`,
      };
    }

    const toolUseBlock = response.content.find((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use');

    if (!toolUseBlock) {
      return {
        ok: false,
        error: `Anthropic response did not contain a tool_use block (stop_reason: ${response.stop_reason ?? 'unknown'})`,
      };
    }

    if (toolUseBlock.name !== request.toolName) {
      return {
        ok: false,
        error: `Anthropic response used unexpected tool "${toolUseBlock.name}", expected "${request.toolName}"`,
      };
    }

    if (!isPlainObject(toolUseBlock.input)) {
      return {
        ok: false,
        error: 'Anthropic tool_use input was not a JSON object',
      };
    }

    return { ok: true, result: toolUseBlock.input as TResult };
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
