import { describe, expect, it } from 'vitest';

import { getWorkflowInfo } from '../features/ai-suggestion/workflow-info';
import { getKeywordCurationWorkflowInfo } from '../features/keyword-curation/workflow-info';
import { AppService } from './app.service';

/**
 * Task 2 (methodology-ai-transparency): this is the first spec file for
 * `AppService` in this repo, and it is scoped ONLY to the newly-added
 * `getAiWorkflows()` method -- it does not retroactively test any
 * pre-existing `AppService` method.
 *
 * Proves the "single source of truth, cannot drift" contract (requirements
 * 2.3, 3.3): this test imports the exact same real, pure functions
 * `getAiWorkflows()` itself composes -- `getWorkflowInfo()` from
 * `ai-suggestion/workflow-info.ts` and `getKeywordCurationWorkflowInfo()`
 * from `keyword-curation/workflow-info.ts` -- and asserts deep equality
 * against their real output, rather than a hand-copied literal. If
 * `AppService.getAiWorkflows()` ever reimplements or paraphrases either
 * source instead of delegating to it, these assertions catch the drift.
 *
 * `AppService`'s constructor deps (`CacheService`,
 * `MvSalaryTypeMedianRatioService`, etc.) are irrelevant to this pure,
 * synchronous method -- it never touches `this` -- so they are stubbed with
 * `{} as any` rather than fully mocked.
 */
describe('AppService.getAiWorkflows', () => {
  function createService(): AppService {
    return new AppService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  }

  it('aiSuggestion equals the real getWorkflowInfo() output (requirements 2.1-2.3)', () => {
    const service = createService();

    const result = service.getAiWorkflows();

    expect(result.aiSuggestion).toEqual(getWorkflowInfo());
  });

  it('keywordCuration equals the real getKeywordCurationWorkflowInfo() output (requirements 3.1, 3.3)', () => {
    const service = createService();

    const result = service.getAiWorkflows();

    expect(result.keywordCuration).toEqual(getKeywordCurationWorkflowInfo());
  });

  it('returns both fields together in a single AiWorkflowsResponse', () => {
    const service = createService();

    const result = service.getAiWorkflows();

    expect(result).toEqual({
      aiSuggestion: getWorkflowInfo(),
      keywordCuration: getKeywordCurationWorkflowInfo(),
    });
  });
});
