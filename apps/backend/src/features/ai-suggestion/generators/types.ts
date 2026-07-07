import type {
  CreateAiSuggestionInput,
  CreatePendingSuggestionResult,
} from '@codeshore/data-utils';
import type { AiSuggestionWorkflow } from '@codeshore/data-types';

/**
 * Shared foundation for the 5 suggestion generators (task 3.1-3.5,
 * requirements 2.1-2.3, 3.1-3.3, 4.1-4.3, 5.1-5.3, 6.1-6.3). Re-exports the
 * canonical `AiSuggestionWorkflow` union from `@codeshore/data-types` rather
 * than redeclaring it here, so this file and
 * `apps/backend/src/features/ai-suggestion/service.ts` can never drift on
 * the set of workflow identifiers.
 */
export type { AiSuggestionWorkflow };

/**
 * Per-run outcome counters for a single generator's `generate()` call.
 *
 * This is deliberately a plain `Promise<GeneratorResult>` rather than
 * design.md's "Generators（Full Block）" `AsyncGenerator<AiSuggestionGenerateEvent>`
 * signature: task 4.2 (which wires generators into the SSE
 * `POST /ai-suggestion/generate` route and is not yet implemented) is where
 * per-event progress streaming actually matters and gets adapted from
 * whichever generator shape lands here first. Keeping each generator's own
 * `generate()` a simple batch result keeps this task (and 3.2-3.5)
 * independently testable without an SSE harness; task 4.2 remains free to
 * wrap `GeneratorResult` into `AiSuggestionGenerateEvent`s (e.g. one
 * `created`/`error` event per counted item, then a final `done`) when it
 * lands.
 */
export interface GeneratorResult {
  created: number;
  skippedDuplicates: number;
  /** Candidates the LLM judged as "no suitable match" -- not an error, just no suggestion created. */
  skippedNoMatch: number;
  errors: Array<{ message: string }>;
}

export function emptyGeneratorResult(): GeneratorResult {
  return { created: 0, skippedDuplicates: 0, skippedNoMatch: 0, errors: [] };
}

export interface SuggestionGenerator {
  readonly workflow: AiSuggestionWorkflow;
  generate(): Promise<GeneratorResult>;
}

/**
 * Narrow collaborator interface for "can create a pending suggestion",
 * satisfied by `apps/backend/src/features/ai-suggestion/service.ts`'s
 * `Service.createSuggestion` (a generator must never write to the
 * data-utils layer directly, and must never call the target-table write
 * services `approve()` uses -- only `Service.createSuggestion`). Kept
 * separate from the full `Service` class so generator tests can fake just
 * this one method instead of every `Service` dependency.
 */
export interface SuggestionCreator {
  createSuggestion(
    input: CreateAiSuggestionInput,
  ): Promise<CreatePendingSuggestionResult>;
}
