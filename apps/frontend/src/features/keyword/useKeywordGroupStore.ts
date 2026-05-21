import { refDebounced } from '@vueuse/core';
import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';

import { SupabaseView } from '@codeshore/data-types';

import {
  createKeywordGroup,
  deleteKeyword,
  deleteKeywordGroup,
  fetchMvKeywordGroup,
  resetMvKeywordGroup,
  updateKeywordGroup,
} from './service';

const PAGE_SIZE = 20;

export type GroupFilter = 'all' | 'grouped' | 'ungrouped';

const GROUPS_FILTER_BASE: Record<
  GroupFilter,
  Record<string, unknown>
> = {
  all: {},
  grouped: { $or: 'category.not.is.null' },
  ungrouped: { $or: 'category.is.null' },
};

export const useKeywordGroupStore = defineStore(
  'keyword-group',
  () => {
    const keywordGroups = ref<
      SupabaseView.KeywordGroupView[]
    >([]);
    const totalCount = ref(0);
    const currentPage = ref(1);
    const groupsFilter = ref<GroupFilter>('all');
    const search = ref('');
    const debouncedSearch = refDebounced(search, 400);
    const loading = ref(false);
    const saving = ref(false);

    const totalPages = computed(() =>
      Math.max(1, Math.ceil(totalCount.value / PAGE_SIZE)),
    );

    const buildWhere = () => {
      const conditions: Record<string, unknown> = {
        ...GROUPS_FILTER_BASE[groupsFilter.value],
      };
      if (debouncedSearch.value.trim()) {
        conditions.keyword_group = {
          ilike: `%${debouncedSearch.value.trim()}%`,
        };
      }
      return Object.keys(conditions).length > 0
        ? JSON.stringify(conditions)
        : undefined;
    };

    const loadGroups = async (
      page = currentPage.value,
      loadingEffect: boolean = false,
    ) => {
      currentPage.value = page;
      loading.value = loadingEffect;
      const from = (page - 1) * PAGE_SIZE;
      const to = page * PAGE_SIZE - 1;
      const { result, count } = await fetchMvKeywordGroup(
        {
          from,
          to,
          where: buildWhere(),
          orders: 'count:desc;keyword_group',
        },
      );
      keywordGroups.value = result;
      totalCount.value = count;
      loading.value = false;
    };

    const setGroupsFilter = (filter: GroupFilter) => {
      groupsFilter.value = filter;
      loadGroups(1, true);
    };

    watch(debouncedSearch, () => loadGroups(1));

    const goToPage = (page: number) => {
      if (page >= 1 && page <= totalPages.value) {
        loadGroups(page, true);
      }
    };

    const prevPage = () => goToPage(currentPage.value - 1);
    const nextPage = () => goToPage(currentPage.value + 1);

    const createGroup = async (
      id: string,
      keywords: string[] = [],
      category: string | null = null,
      parent: string | null = null,
    ) => {
      saving.value = true;
      await createKeywordGroup(
        id,
        keywords,
        category,
        parent,
      );
      await loadGroups(currentPage.value);
      saving.value = false;
    };

    const updateGroup = async (
      id: string,
      data: {
        keywords?: string[];
        category?: string | null;
        parent?: string | null;
      },
    ) => {
      saving.value = true;
      await updateKeywordGroup(id, data);
      saving.value = false;
    };

    const deleteGroup = async (id: string) => {
      saving.value = true;
      await deleteKeywordGroup(id);
      const newTotal = totalCount.value - 1;
      const newTotalPages = Math.max(
        1,
        Math.ceil(newTotal / PAGE_SIZE),
      );
      saving.value = false;
    };

    const assignKeywordToGroup = async (
      keyword: string,
      keywordGroup: string,
    ) => {
      saving.value = true;
      const group = keywordGroups.value.find(
        g => g.keyword_group === keywordGroup,
      );
      await updateKeywordGroup(keywordGroup, {
        keywords: [...(group?.keywords || []), keyword],
        category: group?.category || null,
        parent: group?.parent || null,
      });
      saving.value = false;
    };

    const createGroupFromKeyword = async (
      keyword: string,
      newGroupId: string,
      category: string | null = null,
      parent: string | null = null,
    ) => {
      saving.value = true;
      await createKeywordGroup(
        newGroupId,
        [keyword],
        category,
        parent,
      );
      saving.value = false;
    };

    const removeKeyword = async (id: string) => {
      await deleteKeyword(id);
    };

    const deleteMultiple = async (
      items: Array<{ id: string; isKeyword: boolean }>,
    ) => {
      saving.value = true;
      for (const { id, isKeyword } of items) {
        if (isKeyword) {
          await deleteKeyword(id);
        } else {
          await deleteKeywordGroup(id);
        }
      }
      saving.value = false;
    };

    const selectMode = ref(false);
    const selectedIds = ref<Set<string>>(new Set());

    const allSelected = computed(
      () =>
        selectMode.value &&
        keywordGroups.value.length > 0 &&
        selectedIds.value.size ===
          keywordGroups.value.length,
    );

    function toggleSelectMode(): void {
      selectMode.value = !selectMode.value;
      if (!selectMode.value) {
        selectedIds.value = new Set();
      }
    }

    function toggleSelectId(id: string): void {
      const next = new Set(selectedIds.value);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      selectedIds.value = next;
    }

    function selectAll(): void {
      selectedIds.value = new Set(
        keywordGroups.value.map(g => g.keyword_group),
      );
    }

    function clearSelection(): void {
      selectedIds.value = new Set();
    }

    const refreshMvKeywordGroup = async () => {
      await resetMvKeywordGroup();
      return loadGroups(currentPage.value);
    };

    return {
      keywordGroups,
      totalCount,
      currentPage,
      totalPages,
      groupsFilter,
      search,
      loading,
      saving,
      selectMode,
      selectedIds,
      allSelected,
      loadGroups,
      setGroupsFilter,
      goToPage,
      prevPage,
      nextPage,
      createGroup,
      createGroupFromKeyword,
      updateGroup,
      deleteGroup,
      assignKeywordToGroup,
      removeKeyword,
      deleteMultiple,
      toggleSelectMode,
      toggleSelectId,
      selectAll,
      clearSelection,
      refreshMvKeywordGroup,
    };
  },
);

