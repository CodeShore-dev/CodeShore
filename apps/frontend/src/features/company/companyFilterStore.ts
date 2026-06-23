import { create } from 'zustand';

interface CompanyFilterState {
  search: string;
  selectedKeywordGroups: string[];
  keywordGroupOperator: 'and' | 'or';
  page: number;
  setSearch: (value: string) => void;
  toggleKeywordGroup: (kg: string) => void;
  setOperator: (op: 'and' | 'or') => void;
  clearFilters: () => void;
  setPage: (page: number) => void;
}

// Company UI/filter state (task 6.1). Changing any filter resets to page 1
// (parity with the Vue store's watch that reloaded page 1 on filter change).
export const useCompanyFilterStore = create<CompanyFilterState>(set => ({
  search: '',
  selectedKeywordGroups: [],
  keywordGroupOperator: 'and',
  page: 1,
  setSearch: value => set({ search: value, page: 1 }),
  toggleKeywordGroup: kg =>
    set(state => ({
      selectedKeywordGroups: state.selectedKeywordGroups.includes(kg)
        ? state.selectedKeywordGroups.filter(x => x !== kg)
        : [...state.selectedKeywordGroups, kg],
      page: 1,
    })),
  setOperator: op => set({ keywordGroupOperator: op, page: 1 }),
  clearFilters: () =>
    set({
      search: '',
      selectedKeywordGroups: [],
      keywordGroupOperator: 'and',
      page: 1,
    }),
  setPage: page => set({ page }),
}));

export const selectCompanyHasActiveFilters = (
  state: CompanyFilterState,
): boolean =>
  !!state.search.trim() || state.selectedKeywordGroups.length > 0;
