import { create } from 'zustand';

interface KeywordFilterState {
  selectedTags: string[];
  excludedTags: string[];
  keywordOperator: 'and' | 'or';
  // Catalog browsing UI state (search box + active category tab). `selectedTab`
  // is null until categories load (then defaults to the first tab); '' is a real
  // tab value (the trailing "其他" bucket), so it must stay distinct from null.
  keywordSearch: string;
  selectedTab: string | null;
  setSelectedTags: (tags: string[]) => void;
  setExcludedTags: (tags: string[]) => void;
  setOperator: (op: 'and' | 'or') => void;
  setKeywordSearch: (v: string) => void;
  setSelectedTab: (v: string | null) => void;
  toggleLanguage: (language: string) => void;
  reset: () => void;
}

// Shared keyword selection state (job filtering; also used by keyword admin).
// Ported from the selection part of useKeywordStore.
export const useKeywordFilterStore = create<KeywordFilterState>(set => ({
  selectedTags: [],
  excludedTags: [],
  keywordOperator: 'and',
  keywordSearch: '',
  selectedTab: null,
  setSelectedTags: tags => set({ selectedTags: tags }),
  setExcludedTags: tags => set({ excludedTags: tags }),
  setOperator: op => set({ keywordOperator: op }),
  setKeywordSearch: v => set({ keywordSearch: v }),
  setSelectedTab: v => set({ selectedTab: v }),
  // include -> exclude -> off cycle (parity with useKeywordStore.toggleLanguage)
  toggleLanguage: language =>
    set(state => {
      if (state.selectedTags.includes(language)) {
        return {
          selectedTags: state.selectedTags.filter(x => x !== language),
          excludedTags: [...state.excludedTags, language],
        };
      }
      if (state.excludedTags.includes(language)) {
        return {
          excludedTags: state.excludedTags.filter(x => x !== language),
        };
      }
      return { selectedTags: [...state.selectedTags, language] };
    }),
  reset: () =>
    set({
      selectedTags: [],
      excludedTags: [],
      keywordOperator: 'and',
      keywordSearch: '',
      selectedTab: null,
    }),
}));
