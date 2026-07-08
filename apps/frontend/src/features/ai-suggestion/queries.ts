import { useQuery } from '@tanstack/react-query';

import { AiSuggestionListFilter, fetchSuggestion, fetchSuggestions } from './service';

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
