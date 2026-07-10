import { Injectable } from '@nestjs/common';

import type { AiLlmSettingService } from '@codeshore/data-utils';

import type { LlmClient, StructuredCompletionRequest, StructuredCompletionResult } from '../ai-suggestion/llm-client';
import { OpenRouterLlmClient } from '../ai-suggestion/llm-client';

/**
 * Same `ai_llm_setting` table/row `ai-suggestion/service.ts`'s `generate()`
 * reads its adjustable default model from (`DEFAULT_MODEL_SETTING_KEY` /
 * `DEFAULT_MODEL_FALLBACK` there). Neither constant is exported from that
 * module in a way this feature's boundary allows importing (design.md's
 * inbound-dependency table only lists `ai-suggestion/llm-client.ts`'s
 * `LlmClient` type and `validation/cycle-check.ts`'s
 * `detectTechParentCycle()` as allowed imports), so they are redefined
 * locally here, deliberately using the identical key string and fallback
 * model id since both features resolve the same underlying row.
 */
const DEFAULT_MODEL_SETTING_KEY = 'default_model';
const DEFAULT_MODEL_FALLBACK = 'meta-llama/llama-3.3-70b-instruct:free';

/**
 * Reconciles two constraints that are in tension (see task 4.2's notes):
 *
 *   1. `KeywordCurationGraph` (task 3.6) must be a stable NestJS DI
 *      singleton -- its compiled `app`'s `MemorySaver` checkpointer has to
 *      live across separate HTTP requests for `startSession`'s interrupt and
 *      a later `resumeSession` call (same `thread_id`) to resume the same
 *      paused run. That singleton is built once at module-init time from
 *      `ClassifyNode` -> `CurationLlmClassifier` -> a constructor-injected
 *      `LlmClient`.
 *   2. `OpenRouterLlmClient` (`ai-suggestion/llm-client.ts`) is explicitly
 *      NOT meant to be a stable DI singleton in this repo's convention (see
 *      `ai-suggestion/module.ts`'s comment) -- its constructor takes a fixed
 *      `model: string`, but the actual default model must be re-resolved
 *      per call from the `ai_llm_setting` table (`AiLlmSettingService`) so
 *      admins can change it at runtime without redeploying
 *      (`ai-suggestion/service.ts`'s `generate()` does this per-call).
 *
 * `DynamicLlmClient` itself implements `LlmClient` and IS a stable DI
 * singleton (its own constructor only fixes `AiLlmSettingService`, never a
 * model), but re-resolves the current default model fresh on every
 * `completeStructured()` call and constructs a fresh `OpenRouterLlmClient`
 * for that one call -- so `CurationLlmClassifier` (which depends on
 * `LlmClient`) can also safely be a stable singleton, and by extension so
 * can `ClassifyNode` and `KeywordCurationGraph`.
 */
@Injectable()
export class DynamicLlmClient implements LlmClient {
  constructor(private readonly llmSettingService: Pick<AiLlmSettingService, 'getValue'>) {}

  async completeStructured<TResult extends Record<string, unknown>>(
    request: StructuredCompletionRequest<unknown>,
  ): Promise<StructuredCompletionResult<TResult>> {
    const model =
      (await this.llmSettingService.getValue(DEFAULT_MODEL_SETTING_KEY)) ?? DEFAULT_MODEL_FALLBACK;
    const client = new OpenRouterLlmClient(model);
    return client.completeStructured<TResult>(request);
  }
}
