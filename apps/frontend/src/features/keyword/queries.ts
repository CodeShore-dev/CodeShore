import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useMemo } from 'react';

import { SupabaseView } from '@codeshore/data-types';

import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { CATEGORY_LABEL_MAP } from '../../utils/constants';
import { useKeywordGroupStore, type GroupFilter } from './keywordGroupStore';
import {
  fetchKeywordGroupCategories,
  fetchMvKeywordGroup,
  updateKeywordGroup,
} from './service';

export const KEYWORD_ADMIN_PAGE_SIZE = 20;

const GROUPS_FILTER_BASE: Record<GroupFilter, Record<string, unknown>> = {
  all: {},
  grouped: { $or: 'category.not.is.null' },
  ungrouped: { $or: 'category.is.null' },
};

// Builds the admin group-list `where` clause (task 8.1), mirroring the Vue
// useKeywordGroupStore.buildWhere: grouped/ungrouped base + keyword_group ilike.
export function buildKeywordAdminWhere(
  filter: GroupFilter,
  search: string,
): string | undefined {
  const conditions: Record<string, unknown> = { ...GROUPS_FILTER_BASE[filter] };
  if (search.trim()) {
    conditions.keyword_group = { ilike: `%${search.trim()}%` };
  }
  return Object.keys(conditions).length > 0
    ? JSON.stringify(conditions)
    : undefined;
}

// Paginated admin group list (task 8.1). queryKey carries filter/search/page so
// the list refetches automatically (replaces the Vue store's watch + loadGroups).
export function useKeywordGroupAdminQuery() {
  const groupsFilter = useKeywordGroupStore(s => s.groupsFilter);
  const search = useKeywordGroupStore(s => s.search);
  const page = useKeywordGroupStore(s => s.currentPage);

  const debouncedSearch = useDebouncedValue(search, 400);
  const where = buildKeywordAdminWhere(groupsFilter, debouncedSearch);

  const query = useQuery({
    queryKey: ['keyword', 'admin', groupsFilter, debouncedSearch.trim(), page],
    queryFn: async () => {
      const from = (page - 1) * KEYWORD_ADMIN_PAGE_SIZE;
      const to = page * KEYWORD_ADMIN_PAGE_SIZE - 1;
      return fetchMvKeywordGroup({ from, to, where });
    },
  });

  const keywordGroups = query.data?.result ?? [];
  const totalCount = query.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / KEYWORD_ADMIN_PAGE_SIZE));

  return { keywordGroups, totalCount, totalPages, loading: query.isLoading };
}

export interface KeywordTab {
  label: string;
  value: string;
  count: number;
  tooltip: string;
}

// Derives the category tab list (ported from useKeywordStore): known
// categories in CATEGORY_LABEL_MAP order, then a trailing "其他" bucket
// aggregating everything else. Pure for testability.
export function deriveTabs(
  categories: SupabaseView.MvKeywordGroupCategory[],
): KeywordTab[] {
  const countMap = Object.fromEntries(
    categories.map(({ category, count }) => [category, count]),
  );
  const mapKeys = Object.keys(CATEGORY_LABEL_MAP);
  const knownTabs: KeywordTab[] = mapKeys
    .filter(key => key in countMap)
    .map(key => ({
      label: CATEGORY_LABEL_MAP[key],
      value: key,
      count: countMap[key],
      tooltip: `${CATEGORY_LABEL_MAP[key]} · ${countMap[key]} 個技術`,
    }));
  const othersCount = categories
    .filter(({ category }) => !mapKeys.includes(category))
    .reduce((sum, { count }) => sum + count, 0);
  return [
    ...knownTabs,
    {
      label: '其他',
      value: '',
      count: othersCount,
      tooltip: `其他 · ${othersCount} 個技術`,
    },
  ];
}

// Shared keyword-group catalog (prerequisite for Company/Job/Keyword features).
// Returns the keyword groups that have a category.
export function useKeywordGroupsQuery() {
  return useQuery({
    queryKey: ['keyword', 'groups'],
    queryFn: async () =>
      (
        await fetchMvKeywordGroup({
          from: 0,
          to: -1,
          where: JSON.stringify({ $or: 'category.not.is.null' }),
        })
      ).result,
  });
}

// Shared keyword categories + derived tabs.
export function useKeywordCategoriesQuery() {
  const query = useQuery({
    queryKey: ['keyword', 'categories'],
    queryFn: async () =>
      (await fetchKeywordGroupCategories({ from: 0, to: -1 })).result,
  });
  const categories = query.data ?? [];
  const tabs = useMemo(() => deriveTabs(categories), [categories]);
  return { categories, tabs, loading: query.isLoading };
}

// Assigns a keyword to a (possibly new) keyword group, then refreshes the
// catalog and the job list (a remapped JD changes which jobs match a tag).
// Ported from useKeywordStore.saveKeywordToGroup (used by the job-detail
// keyword popover, task 7.5).
export function useSaveKeywordToGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      groupId,
      keyword,
      category,
    }: {
      groupId: string;
      keyword: string;
      category?: string | null;
    }) => updateKeywordGroup(groupId, { keywords: [keyword], category }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keyword', 'groups'] });
      queryClient.invalidateQueries({ queryKey: ['job', 'list'] });
    },
  });
}
