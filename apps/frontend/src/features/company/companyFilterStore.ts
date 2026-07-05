import { create } from 'zustand';

export type CompanyFilterMode = 'include' | 'exclude';

export interface CompanyFilterEntry {
  name: string;
  mode: CompanyFilterMode;
}

interface CompanyFilterState {
  companyFilters: CompanyFilterEntry[];
  page: number;
  addCompanyFilter: (name: string) => void;
  removeCompanyFilter: (name: string) => void;
  toggleCompanyFilterMode: (name: string) => void;
  clearFilters: () => void;
  setPage: (page: number) => void;
}

// Company UI/filter state (task 2.1). Changing any filter resets to page 1
// (parity with the Vue store's watch that reloaded page 1 on filter change).
// Technology selection lives in its own store (companyTechFilterStore, task
// 3.1), not here.
export const useCompanyFilterStore = create<CompanyFilterState>((set, get) => ({
  companyFilters: [],
  page: 1,
  addCompanyFilter: name => {
    const existing = get().companyFilters;
    const withoutExisting = existing.filter(entry => entry.name !== name);
    // Adding an already-present company re-adds it as `include`, mirroring
    // jobFilterStore's semantics: picking a company from the search
    // suggestions always means "I want this included", regardless of any
    // prior exclude toggle.
    set({
      companyFilters: [...withoutExisting, { name, mode: 'include' }],
      page: 1,
    });
  },
  removeCompanyFilter: name =>
    set({
      companyFilters: get().companyFilters.filter(
        entry => entry.name !== name,
      ),
      page: 1,
    }),
  toggleCompanyFilterMode: name =>
    set({
      companyFilters: get().companyFilters.map(entry =>
        entry.name === name
          ? {
              ...entry,
              mode: entry.mode === 'include' ? 'exclude' : 'include',
            }
          : entry,
      ),
      page: 1,
    }),
  clearFilters: () =>
    set({
      companyFilters: [],
      page: 1,
    }),
  setPage: page => set({ page }),
}));

export const selectCompanyHasActiveFilters = (
  state: CompanyFilterState,
): boolean => state.companyFilters.length > 0;
