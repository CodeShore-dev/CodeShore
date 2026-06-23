import { create } from 'zustand';

interface CompanyFilterState {
  search: string;
  selectedTechs: string[];
  techOperator: 'and' | 'or';
  page: number;
  setSearch: (value: string) => void;
  toggleTech: (kg: string) => void;
  setOperator: (op: 'and' | 'or') => void;
  clearFilters: () => void;
  setPage: (page: number) => void;
}

// Company UI/filter state (task 6.1). Changing any filter resets to page 1
// (parity with the Vue store's watch that reloaded page 1 on filter change).
export const useCompanyFilterStore = create<CompanyFilterState>(set => ({
  search: '',
  selectedTechs: [],
  techOperator: 'and',
  page: 1,
  setSearch: value => set({ search: value, page: 1 }),
  toggleTech: kg =>
    set(state => ({
      selectedTechs: state.selectedTechs.includes(kg)
        ? state.selectedTechs.filter(x => x !== kg)
        : [...state.selectedTechs, kg],
      page: 1,
    })),
  setOperator: op => set({ techOperator: op, page: 1 }),
  clearFilters: () =>
    set({
      search: '',
      selectedTechs: [],
      techOperator: 'and',
      page: 1,
    }),
  setPage: page => set({ page }),
}));

export const selectCompanyHasActiveFilters = (
  state: CompanyFilterState,
): boolean =>
  !!state.search.trim() || state.selectedTechs.length > 0;
