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
 * Per-run outcome counters for a single generator's `generate()` call --
 * the final (`return`) value of the `AsyncGenerator` below once every
 * candidate has been processed.
 */
export interface GeneratorResult {
  created: number;
  skippedDuplicates: number;
  /** Candidates the LLM judged as "no suitable match" -- not an error, just no suggestion created. */
  skippedNoMatch: number;
  /**
   * Candidate edges rejected because a validation hook (e.g.
   * `detectTechParentCycle`, task 1.4/3.3) determined creating the
   * suggestion would form a cycle or other structural conflict. Deliberately
   * distinct from `errors`: a detected cycle is the check working correctly
   * (requirement 4.2, 8.2), not a system failure, so it must not be counted
   * or reported the same way a thrown/failed operation is. Generators that
   * have no such conflict-detecting validation hook (3.1, 3.2) simply never
   * increment this field.
   */
  skippedConflict: number;
  errors: Array<{ message: string }>;
}

export function emptyGeneratorResult(): GeneratorResult {
  return {
    created: 0,
    skippedDuplicates: 0,
    skippedNoMatch: 0,
    skippedConflict: 0,
    errors: [],
  };
}

/**
 * A single incremental progress step yielded mid-run (e.g. "candidate 3/12"),
 * relayed by `Service.generate()` as a `log` `AiSuggestionGenerateEvent` for
 * requirement 1.2's "逐步回報產生進度". Deliberately just a `message` --
 * `workflow` is already known to the caller from which `SuggestionGenerator`
 * is being driven, so it is not duplicated here.
 */
export interface GeneratorProgress {
  message: string;
}

export interface SuggestionGenerator {
  readonly workflow: AiSuggestionWorkflow;
  generate(): AsyncGenerator<GeneratorProgress, GeneratorResult>;
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
