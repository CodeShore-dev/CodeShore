import { create } from 'zustand';

interface JobFilterState {
  searchText: string;
  companySearchText: string;
  salaryFilter: 'none' | 'excluding' | 'only';
  salaryAmount: { type: 'month' | 'year' | ''; amount: number | null };
  selectedLocations: string[];
  excludedCompanies: string[];
  sort: 'salary' | 'recent';
  page: number;
  listViewPreference: 'like' | 'dislike' | null;
  selectedJobId: string | null;
  setSearchText: (v: string) => void;
  setCompanySearchText: (v: string) => void;
  setSalaryFilter: (v: 'none' | 'excluding' | 'only') => void;
  setSalaryAmount: (v: {
    type: 'month' | 'year' | '';
    amount: number | null;
  }) => void;
  setSelectedLocations: (v: string[]) => void;
  setExcludedCompanies: (v: string[]) => void;
  setSort: (v: 'salary' | 'recent') => void;
  setPage: (v: number) => void;
  setListViewPreference: (v: 'like' | 'dislike' | null) => void;
  setSelectedJobId: (v: string | null) => void;
  reset: () => void;
}

// Job UI/filter state (task 7.1). Filter changes reset to page 1 (parity with
// the Vue watch(baseFilters) that refetched page 1). Server data lives in
// TanStack Query (task 7.2), not here.
export const useJobFilterStore = create<JobFilterState>(set => ({
  searchText: '',
  companySearchText: '',
  salaryFilter: 'none',
  salaryAmount: { type: '', amount: null },
  selectedLocations: [],
  excludedCompanies: [],
  sort: 'salary',
  page: 1,
  listViewPreference: null,
  selectedJobId: null,
  setSearchText: v => set({ searchText: v, page: 1 }),
  setCompanySearchText: v => set({ companySearchText: v, page: 1 }),
  setSalaryFilter: v => set({ salaryFilter: v, page: 1 }),
  setSalaryAmount: v => set({ salaryAmount: v, page: 1 }),
  setSelectedLocations: v => set({ selectedLocations: v, page: 1 }),
  setExcludedCompanies: v => set({ excludedCompanies: v, page: 1 }),
  setSort: v => set({ sort: v, page: 1 }),
  setPage: v => set({ page: v }),
  setListViewPreference: v => set({ listViewPreference: v, page: 1 }),
  setSelectedJobId: v => set({ selectedJobId: v }),
  reset: () =>
    set({
      searchText: '',
      companySearchText: '',
      salaryFilter: 'none',
      salaryAmount: { type: '', amount: null },
      selectedLocations: [],
      excludedCompanies: [],
      sort: 'salary',
      page: 1,
      listViewPreference: null,
      selectedJobId: null,
    }),
}));
