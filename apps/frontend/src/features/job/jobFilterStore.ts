import { create } from 'zustand';

import type {
  CompanyFilterEntry,
  CompanyFilterMode,
} from '../company/companyFilterStore';

// Re-exported so existing call sites (e.g. deriveJobWhere.ts) that import
// these types from jobFilterStore.ts keep working unchanged (task 7.2). The
// canonical definition now lives in companyFilterStore.ts (task 2.1).
export type { CompanyFilterEntry, CompanyFilterMode };

interface JobFilterState {
  searchText: string;
  companyFilters: CompanyFilterEntry[];
  salaryFilter: 'none' | 'excluding' | 'only';
  salaryAmount: { type: 'month' | 'year' | ''; amount: number | null };
  selectedLocations: string[];
  sort: 'salary' | 'recent';
  page: number;
  listViewPreference: 'like' | 'dislike' | null;
  // Sub-category (reason) filter inside the like/dislike tabs. Deliberately
  // not synced to the URL (design D6); null means 「全部」.
  preferenceReason: string | null;
  selectedJobId: string | null;
  setSearchText: (v: string) => void;
  addCompanyFilter: (name: string) => void;
  removeCompanyFilter: (name: string) => void;
  toggleCompanyFilterMode: (name: string) => void;
  setSalaryFilter: (v: 'none' | 'excluding' | 'only') => void;
  setSalaryAmount: (v: {
    type: 'month' | 'year' | '';
    amount: number | null;
  }) => void;
  setSelectedLocations: (v: string[]) => void;
  setSort: (v: 'salary' | 'recent') => void;
  setPage: (v: number) => void;
  setListViewPreference: (v: 'like' | 'dislike' | null) => void;
  setPreferenceReason: (v: string | null) => void;
  setSelectedJobId: (v: string | null) => void;
  reset: () => void;
}

// Job UI/filter state (task 7.1). Filter changes reset to page 1 (parity with
// the Vue watch(baseFilters) that refetched page 1). Server data lives in
// TanStack Query (task 7.2), not here.
export const useJobFilterStore = create<JobFilterState>((set, get) => ({
  searchText: '',
  companyFilters: [],
  salaryFilter: 'none',
  salaryAmount: { type: '', amount: null },
  selectedLocations: [],
  sort: 'salary',
  page: 1,
  listViewPreference: null,
  preferenceReason: null,
  selectedJobId: null,
  setSearchText: v => set({ searchText: v, page: 1 }),
  addCompanyFilter: name => {
    const existing = get().companyFilters;
    const withoutExisting = existing.filter(entry => entry.name !== name);
    // Adding an already-present company re-adds it as `include`, mirroring
    // the "select from suggestions" flow in design.md (4.1-4.4): picking a
    // company from the search suggestions always means "I want this
    // included", regardless of any prior exclude toggle.
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
  setSalaryFilter: v => set({ salaryFilter: v, page: 1 }),
  setSalaryAmount: v => set({ salaryAmount: v, page: 1 }),
  setSelectedLocations: v => set({ selectedLocations: v, page: 1 }),
  setSort: v => set({ sort: v, page: 1 }),
  setPage: v => set({ page: v }),
  // Switching tabs resets the reason filter to 「全部」 (req 7.5).
  setListViewPreference: v =>
    set({ listViewPreference: v, preferenceReason: null, page: 1 }),
  setPreferenceReason: v => set({ preferenceReason: v, page: 1 }),
  setSelectedJobId: v => set({ selectedJobId: v }),
  reset: () =>
    set({
      searchText: '',
      companyFilters: [],
      salaryFilter: 'none',
      salaryAmount: { type: '', amount: null },
      selectedLocations: [],
      sort: 'salary',
      page: 1,
      listViewPreference: null,
      preferenceReason: null,
      selectedJobId: null,
    }),
}));
