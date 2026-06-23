import { create } from 'zustand';

export type GroupFilter = 'all' | 'grouped' | 'ungrouped';

// Admin keyword-group manager UI state (task 8.1). Server data (the paginated
// group list) lives in TanStack Query (useKeywordGroupAdminQuery); this store
// only holds the filter/search/page and the bulk-selection UI, ported from the
// UI parts of useKeywordGroupStore (Pinia). Changing the filter or search
// resets to page 1 (parity with the Vue store's loadGroups(1) on change).
interface KeywordGroupState {
  groupsFilter: GroupFilter;
  search: string;
  currentPage: number;
  selectMode: boolean;
  selectedIds: Set<string>;
  setGroupsFilter: (filter: GroupFilter) => void;
  setSearch: (value: string) => void;
  setPage: (page: number) => void;
  toggleSelectMode: () => void;
  toggleSelectId: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
}

export const useKeywordGroupStore = create<KeywordGroupState>(set => ({
  groupsFilter: 'all',
  search: '',
  currentPage: 1,
  selectMode: false,
  selectedIds: new Set<string>(),
  setGroupsFilter: filter => set({ groupsFilter: filter, currentPage: 1 }),
  setSearch: value => set({ search: value, currentPage: 1 }),
  setPage: page => set({ currentPage: page }),
  toggleSelectMode: () =>
    set(state => ({
      selectMode: !state.selectMode,
      // leaving select mode clears the current selection (parity with Vue)
      selectedIds: state.selectMode ? new Set<string>() : state.selectedIds,
    })),
  toggleSelectId: id =>
    set(state => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),
  selectAll: ids => set({ selectedIds: new Set(ids) }),
  clearSelection: () => set({ selectedIds: new Set<string>() }),
}));
