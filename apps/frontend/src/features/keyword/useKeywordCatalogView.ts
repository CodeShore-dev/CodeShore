import { useEffect, useMemo } from 'react';
import type { StoreApi, UseBoundStore } from 'zustand';

import type { SupabaseView } from '@codeshore/data-types';

import { CATEGORY_LABEL_MAP } from '../../utils/constants';
import type { KeywordFilterState } from './keywordFilterStore';
import {
  type KeywordTab,
  useKeywordCategoriesQuery,
  useTechsQuery,
} from './queries';

export const SEARCH_TAB_VALUE = '__search__';
export const RELATED_TAB_VALUE = '__related__';

export interface TechCatalogView {
  techs: SupabaseView.MvTech[];
  visibleTabs: KeywordTab[];
  selectedTab: string | null;
  setSelectedTab: (v: string | null) => void;
  keywordSearch: string;
  setKeywordSearch: (v: string) => void;
  categoriesWithSelections: Set<string>;
  filteredTechView: SupabaseView.MvTech[];
  selectedTags: string[];
  excludedTags: string[];
  keywordOperator: 'and' | 'or';
  setOperator: (op: 'and' | 'or') => void;
  toggleTech: (tech: string) => void;
}

// Derived view over the shared keyword catalog for the filter panels (task 7.5;
// parameterized in task 1.2 so job and company features can each hold an
// independent selection store instance). React port of the computed getters in
// useKeywordStore: search/related virtual tabs, category tabs, the "categories
// with active selections" set, and the list of keyword groups shown for the
// active tab. Selection + browsing state live in the passed-in store instance
// (created via createTechFilterStore); the catalog itself comes from the
// shared queries.
export function useKeywordCatalogView(
  useSelectionStore: UseBoundStore<StoreApi<KeywordFilterState>>,
): TechCatalogView {
  const { data: techs = [] } = useTechsQuery();
  const { tabs } = useKeywordCategoriesQuery();

  const selectedTags = useSelectionStore(s => s.selectedTags);
  const excludedTags = useSelectionStore(s => s.excludedTags);
  const keywordSearch = useSelectionStore(s => s.keywordSearch);
  const selectedTabRaw = useSelectionStore(s => s.selectedTab);
  const setSelectedTab = useSelectionStore(s => s.setSelectedTab);
  const setKeywordSearch = useSelectionStore(s => s.setKeywordSearch);
  const keywordOperator = useSelectionStore(s => s.keywordOperator);
  const setOperator = useSelectionStore(s => s.setOperator);
  const toggleTech = useSelectionStore(s => s.toggleLanguage);

  // Until the user picks a tab, default to the first category once loaded.
  const selectedTab =
    selectedTabRaw === null ? (tabs[0]?.value ?? null) : selectedTabRaw;

  const searchedView = useMemo(() => {
    const q = keywordSearch.trim().toLowerCase();
    if (!q) return [];
    return techs.filter(g => g.label.toLowerCase().includes(q));
  }, [keywordSearch, techs]);

  const relatedView = useMemo(() => {
    if (!selectedTags.length && !excludedTags.length) return [];
    const allActive = [...selectedTags, ...excludedTags];
    return techs.filter(g => {
      if (allActive.includes(g.tech)) return false;
      return !!g.parents && allActive.some(x => g.parents.includes(x));
    });
  }, [selectedTags, excludedTags, techs]);

  const visibleTabs = useMemo<KeywordTab[]>(() => {
    const base: KeywordTab[] = [];
    const q = keywordSearch.trim();
    if (q) {
      const count = searchedView.length;
      base.push({
        label: '搜尋',
        value: SEARCH_TAB_VALUE,
        count,
        tooltip: `搜尋「${q}」· ${count} 個技術`,
      });
    }
    if (
      (selectedTags.length || excludedTags.length) &&
      relatedView.length > 0
    ) {
      const count = relatedView.length;
      const tagList = [...selectedTags, ...excludedTags].join('、');
      base.push({
        label: '相關',
        value: RELATED_TAB_VALUE,
        count,
        tooltip: `與 ${tagList} 相關 · ${count} 個技術`,
      });
    }
    return [...base, ...tabs];
  }, [keywordSearch, searchedView, selectedTags, excludedTags, relatedView, tabs]);

  const categoriesWithSelections = useMemo(() => {
    const result = new Set<string>();
    const allCategories = Object.keys(CATEGORY_LABEL_MAP);
    for (const tag of [...selectedTags, ...excludedTags]) {
      const group = techs.find(g => g.tech === tag);
      if (group?.category) {
        result.add(allCategories.includes(group.category) ? group.category : '');
      }
    }
    return result;
  }, [selectedTags, excludedTags, techs]);

  const filteredTechView = useMemo(() => {
    if (selectedTab === SEARCH_TAB_VALUE) return searchedView;
    if (selectedTab === RELATED_TAB_VALUE) return relatedView;
    if (!selectedTab) {
      const known = tabs.filter(t => t.value !== '').map(t => t.value);
      return techs.filter(g => !known.includes(g.category ?? ''));
    }
    return techs.filter(g => g.category === selectedTab);
  }, [selectedTab, searchedView, relatedView, techs, tabs]);

  // Typing a search jumps to the virtual search tab; clearing it returns to the
  // first real tab. Reads current tab from the store to avoid stale closures.
  useEffect(() => {
    const store = useSelectionStore.getState();
    if (keywordSearch.trim()) {
      if (store.selectedTab !== SEARCH_TAB_VALUE) {
        store.setSelectedTab(SEARCH_TAB_VALUE);
      }
    } else if (store.selectedTab === SEARCH_TAB_VALUE) {
      store.setSelectedTab(tabs[0]?.value ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keywordSearch, useSelectionStore]);

  // When all selections are cleared while on the virtual related tab, fall back.
  useEffect(() => {
    const store = useSelectionStore.getState();
    if (
      !selectedTags.length &&
      !excludedTags.length &&
      store.selectedTab === RELATED_TAB_VALUE
    ) {
      store.setSelectedTab(tabs[0]?.value ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTags, excludedTags, useSelectionStore]);

  return {
    techs,
    visibleTabs,
    selectedTab,
    setSelectedTab,
    keywordSearch,
    setKeywordSearch,
    categoriesWithSelections,
    filteredTechView,
    selectedTags,
    excludedTags,
    keywordOperator,
    setOperator,
    toggleTech,
  };
}
