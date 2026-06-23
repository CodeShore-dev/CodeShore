import { create } from 'zustand';

interface KeywordFilterState {
  selectedTags: string[];
  excludedTags: string[];
  keywordOperator: 'and' | 'or';
  setSelectedTags: (tags: string[]) => void;
  setExcludedTags: (tags: string[]) => void;
  setOperator: (op: 'and' | 'or') => void;
  toggleLanguage: (language: string) => void;
  reset: () => void;
}

// Shared keyword selection state (job filtering; also used by keyword admin).
// Ported from the selection part of useKeywordStore.
export const useKeywordFilterStore = create<KeywordFilterState>(set => ({
  selectedTags: [],
  excludedTags: [],
  keywordOperator: 'and',
  setSelectedTags: tags => set({ selectedTags: tags }),
  setExcludedTags: tags => set({ excludedTags: tags }),
  setOperator: op => set({ keywordOperator: op }),
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
    set({ selectedTags: [], excludedTags: [], keywordOperator: 'and' }),
}));
