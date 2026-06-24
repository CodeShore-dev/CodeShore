import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ListResponse, SupabaseView } from '@codeshore/data-types';

import {
  createTech,
  deleteKeyword,
  deleteTech,
  resetMvTech,
  updateTech,
  updateTechIconSlugs,
} from './service';

type AdminListData = ListResponse<SupabaseView.MvTech>;

export interface DeletableItem {
  id: string;
  isKeyword: boolean;
}

// Invalidates everything that depends on the keyword catalog: the admin list,
// the shared group catalog, and the category tabs.
function invalidateCatalog(
  queryClient: ReturnType<typeof useQueryClient>,
): void {
  queryClient.invalidateQueries({ queryKey: ['keyword', 'admin'] });
  queryClient.invalidateQueries({ queryKey: ['keyword', 'groups'] });
  queryClient.invalidateQueries({ queryKey: ['keyword', 'categories'] });
}

// Optimistically removes the given ids from every cached admin list page and
// decrements the count; returns a snapshot for rollback. Shared by the single
// and bulk delete mutations (task 8.2, requirement 7.3: keep data consistent).
async function optimisticRemove(
  queryClient: ReturnType<typeof useQueryClient>,
  ids: string[],
) {
  await queryClient.cancelQueries({ queryKey: ['keyword', 'admin'] });
  const idSet = new Set(ids);
  const prev = queryClient.getQueriesData<AdminListData>({
    queryKey: ['keyword', 'admin'],
  });
  queryClient.setQueriesData<AdminListData>(
    { queryKey: ['keyword', 'admin'] },
    old => {
      if (!old) return old;
      const result = old.result.filter(
        g => !idSet.has(g.tech),
      );
      const removed = old.result.length - result.length;
      return { ...old, result, count: Math.max(0, old.count - removed) };
    },
  );
  return prev;
}

function rollback(
  queryClient: ReturnType<typeof useQueryClient>,
  prev: [readonly unknown[], AdminListData | undefined][],
): void {
  prev.forEach(([key, data]) => queryClient.setQueryData(key, data));
}

// Deletes one item — a bare keyword (category === null) via deleteKeyword,
// otherwise the whole group via deleteTech (parity with the Vue card's
// handleDelete). Optimistic removal, rollback on error, invalidate on settle.
export function useDeleteKeywordItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isKeyword }: DeletableItem) =>
      isKeyword ? deleteKeyword(id) : deleteTech(id),
    onMutate: ({ id }) => optimisticRemove(queryClient, [id]),
    onError: (_e, _v, prev) => prev && rollback(queryClient, prev),
    onSettled: () => invalidateCatalog(queryClient),
  });
}

// Bulk delete (task 8.2): deletes each selected item sequentially, the same
// order as the Vue store.deleteMultiple.
export function useBulkDeleteKeywordItemsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: DeletableItem[]) => {
      for (const { id, isKeyword } of items) {
        if (isKeyword) await deleteKeyword(id);
        else await deleteTech(id);
      }
    },
    onMutate: items => optimisticRemove(queryClient, items.map(i => i.id)),
    onError: (_e, _v, prev) => prev && rollback(queryClient, prev),
    onSettled: () => invalidateCatalog(queryClient),
  });
}

// Reorders a group's icon sources. Optimistically patches the cached row in
// place (no full invalidate, so the list doesn't flash a skeleton — parity with
// the Vue store.updateIconSlugs comment).
export function useUpdateIconSlugsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, iconSlugs }: { id: string; iconSlugs: string[] }) =>
      updateTechIconSlugs(id, iconSlugs),
    onMutate: async ({ id, iconSlugs }) => {
      await queryClient.cancelQueries({ queryKey: ['keyword', 'admin'] });
      const prev = queryClient.getQueriesData<AdminListData>({
        queryKey: ['keyword', 'admin'],
      });
      queryClient.setQueriesData<AdminListData>(
        { queryKey: ['keyword', 'admin'] },
        old =>
          old
            ? {
                ...old,
                result: old.result.map(g =>
                  g.tech === id
                    ? { ...g, icon_slugs: iconSlugs }
                    : g,
                ),
              }
            : old,
      );
      return prev;
    },
    onError: (_e, _v, prev) => prev && rollback(queryClient, prev),
  });
}

// Forces a server-side rematch of keywords→groups, then reloads the catalog.
export function useRefreshCatalogMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => resetMvTech(),
    onSuccess: () => invalidateCatalog(queryClient),
  });
}

// Creates a new keyword group (task 8.2).
export function useCreateTechMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      keywords = [],
      category = null,
      parent = null,
    }: {
      id: string;
      keywords?: string[];
      category?: string | null;
      parent?: string | null;
    }) => createTech(id, keywords, category, parent),
    onSuccess: () => invalidateCatalog(queryClient),
  });
}

// Updates a group's keywords / category / parent (edit + category assignment +
// parent hierarchy, task 8.2).
export function useUpdateTechMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        keywords?: string[];
        category?: string | null;
        parent?: string | null;
      };
    }) => updateTech(id, data),
    onSuccess: () => invalidateCatalog(queryClient),
  });
}

// Assigns a bare keyword into an existing group, preserving the group's current
// keywords/category/parent (parity with Vue store.assignKeywordToGroup).
export function useAssignKeywordToGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      keyword,
      group,
    }: {
      keyword: string;
      group: SupabaseView.MvTech;
    }) =>
      updateTech(group.tech, {
        keywords: [...(group.keywords ?? []), keyword],
        category: group.category ?? null,
        parent: group.parents?.[0] ?? null,
      }),
    onSuccess: () => invalidateCatalog(queryClient),
  });
}
