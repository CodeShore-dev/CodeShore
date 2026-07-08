import { useQuery } from '@tanstack/react-query';

import {
  AiSuggestionListFilter,
  fetchLlmSettings,
  fetchSuggestion,
  fetchSuggestions,
  fetchWorkflowInfo,
} from './service';

// Filterable suggestion list (requirement 7.1: 依目標資料表、狀態篩選待審建議
// 清單). queryKey carries the filter so changing targetTable/status refetches
// automatically (parity with keyword/admin's useTechAdminQuery pattern).
export function useSuggestionsQuery(filter: AiSuggestionListFilter = {}) {
  return useQuery({
    queryKey: [
      'ai-suggestion',
      'list',
      filter.targetTable ?? null,
      filter.status ?? null,
      filter.createdAfter ?? null,
      filter.createdBefore ?? null,
    ],
    queryFn: () => fetchSuggestions(filter),
  });
}

// Single suggestion detail (requirement 7.2), including its full evidence.
// Disabled until an id is selected.
export function useSuggestionQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['ai-suggestion', 'detail', id],
    queryFn: () => fetchSuggestion(id as string),
    enabled: !!id,
  });
}

// Backend-adjustable default LLM model (`GET /ai-suggestion/llm-settings`):
// the model `generate()` calls fall back to when a run doesn't specify a
// per-call override.
export function useLlmSettingsQuery() {
  return useQuery({
    queryKey: ['ai-suggestion', 'llm-settings'],
    queryFn: () => fetchLlmSettings(),
  });
}

// Each sub-workflow's real, static LLM prompt template / expected output
// schema (`GET /ai-suggestion/workflow-info`), for the review page's
// "查看工作流說明" transparency panel. Static content, so an
// infinite/no-refetch staleTime would also be reasonable, but this simply
// follows the same default caching as the other queries above.
export function useWorkflowInfoQuery() {
  return useQuery({
    queryKey: ['ai-suggestion', 'workflow-info'],
    queryFn: () => fetchWorkflowInfo(),
  });
}
