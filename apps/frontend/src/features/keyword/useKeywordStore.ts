import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';

import { SupabaseView } from '@codeshore/data-types';

import {
  fetchKeywordGroupCategories,
  fetchMvKeywordGroup,
  updateKeywordGroup,
} from './service';

export const CATEGORY_LABEL_MAP: Record<string, string> = {
  language: '語言',
  framework: '框架',
  database: '資料庫',
  library: '程式庫',
  service: '服務',
  tool: '工具',
  cloud: '雲端',
  others: '其他',
};

type Tab = {
  label: string;
  value: string;
  count: number;
  tooltip: string;
};

export const useKeywordStore = defineStore(
  'keyword',
  () => {
    const keywordGroups = ref<
      SupabaseView.MvKeywordGroup[]
    >([]);
    const loading = ref(false);

    const selectedTags = ref<string[]>([]);
    const excludedTags = ref<string[]>([]);
    const keywordOperator = ref<'and' | 'or'>('and');
    const categories = ref<
      SupabaseView.MvKeywordGroupCategory[]
    >([]);
    const tabs = ref<Tab[]>([]);
    const selectedTab = ref<string>('');

    const getKeywordGroupCategories = async () => {
      const { result } = await fetchKeywordGroupCategories({
        from: 0,
        to: -1,
      });
      categories.value = result;
      const countMap = Object.fromEntries(
        result.map(({ category, count }) => [
          category,
          count,
        ]),
      );
      const mapKeys = Object.keys(CATEGORY_LABEL_MAP);
      const knownTabs: Tab[] = mapKeys
        .filter(key => key in countMap)
        .map(key => ({
          label: CATEGORY_LABEL_MAP[key],
          value: key,
          count: countMap[key],
          tooltip: `${CATEGORY_LABEL_MAP[key]} · ${countMap[key]} 個技術`,
        }));
      const othersCount = result
        .filter(
          ({ category }) => !mapKeys.includes(category),
        )
        .reduce((sum, { count }) => sum + count, 0);
      tabs.value = [
        ...knownTabs,
        {
          label: '其他',
          value: '',
          count: othersCount,
          tooltip: `其他 · ${othersCount} 個技術`,
        },
      ];
      if (tabs.value.length > 0) {
        selectedTab.value = tabs.value[0].value;
      }
    };

    const getMvKeywordGroup = async () => {
      loading.value = true;
      ({ result: keywordGroups.value } =
        await fetchMvKeywordGroup({
          from: 0,
          to: -1,
          where: JSON.stringify({
            $or: 'category.not.is.null',
          }),
        }));
      loading.value = false;
    };

    const SEARCH_TAB_VALUE = '__search__';
    const RELATED_TAB_VALUE = '__related__';

    const keywordSearch = ref('');

    const searchedKeywordGroupView = computed(() => {
      const q = keywordSearch.value.trim().toLowerCase();
      if (!q) return [];
      return keywordGroups.value.filter(g =>
        g.label.toLowerCase().includes(q),
      );
    });

    watch(keywordSearch, q => {
      if (q.trim()) {
        selectedTab.value = SEARCH_TAB_VALUE;
      } else if (selectedTab.value === SEARCH_TAB_VALUE) {
        selectedTab.value =
          visibleTabs.value.find(
            t => t.value !== SEARCH_TAB_VALUE,
          )?.value ??
          tabs.value[0]?.value ??
          '';
      }
    });

    const relatedKeywordGroupView = computed(() => {
      if (
        !selectedTags.value.length &&
        !excludedTags.value.length
      )
        return [];
      const allActiveTags = [
        ...selectedTags.value,
        ...excludedTags.value,
      ];
      const selectedGroups = keywordGroups.value.filter(g =>
        allActiveTags.includes(g.keyword_group),
      );
      const selectedParents = new Set(
        selectedGroups
          .map(g => g.parent)
          .filter((p): p is string => !!p),
      );
      return keywordGroups.value.filter(g => {
        if (allActiveTags.includes(g.keyword_group))
          return false;
        if (!!g.parent && allActiveTags.includes(g.parent))
          return true;
        if (!!g.parent && selectedParents.has(g.parent))
          return true;
        return false;
      });
    });

    const visibleTabs = computed<Tab[]>(() => {
      const base: Tab[] = [];
      if (keywordSearch.value.trim()) {
        const count = searchedKeywordGroupView.value.length;
        base.push({
          label: '搜尋',
          value: SEARCH_TAB_VALUE,
          count,
          tooltip: `搜尋「${keywordSearch.value.trim()}」· ${count} 個技術`,
        });
      }
      if (
        (selectedTags.value.length ||
          excludedTags.value.length) &&
        relatedKeywordGroupView.value.length > 0
      ) {
        const count = relatedKeywordGroupView.value.length;
        const tagList = [
          ...selectedTags.value,
          ...excludedTags.value,
        ].join('、');
        base.push({
          label: '相關',
          value: RELATED_TAB_VALUE,
          count,
          tooltip: `與 ${tagList} 相關 · ${count} 個技術`,
        });
      }
      return [...base, ...tabs.value];
    });

    watch(
      [selectedTags, excludedTags],
      ([tags, excluded]) => {
        if (
          !tags.length &&
          !excluded.length &&
          selectedTab.value === RELATED_TAB_VALUE
        ) {
          selectedTab.value = tabs.value[0]?.value ?? '';
        }
      },
    );

    const categoriesWithSelections = computed(() => {
      const result = new Set<string>();
      const allCategories = Object.keys(CATEGORY_LABEL_MAP);
      for (const tag of [
        ...selectedTags.value,
        ...excludedTags.value,
      ]) {
        const group = keywordGroups.value.find(
          g => g.keyword_group === tag,
        );
        if (group && group.category) {
          if (allCategories.includes(group.category)) {
            result.add(group.category);
          } else {
            result.add('');
          }
        }
      }
      return result;
    });

    const filteredKeywordGroupView = computed(() => {
      if (selectedTab.value === SEARCH_TAB_VALUE)
        return searchedKeywordGroupView.value;
      if (selectedTab.value === RELATED_TAB_VALUE)
        return relatedKeywordGroupView.value;
      if (!selectedTab.value) {
        const others = tabs.value
          .filter(tab => tab.value !== '')
          .map(tab => tab.value);
        return keywordGroups.value.filter(
          keywordGroup =>
            !others.includes(keywordGroup.category ?? ''),
        );
      }
      return keywordGroups.value.filter(
        keywordGroup =>
          keywordGroup.category === selectedTab.value,
      );
    });

    const saveKeywordToGroup = async (
      groupId: string,
      keyword: string,
      category?: string | null,
      parent?: string | null,
    ) => {
      await updateKeywordGroup(groupId, {
        keywords: [keyword],
        category,
        parent,
      });
      await getMvKeywordGroup();
    };

    const toggleLanguage = (language: string) => {
      if (selectedTags.value.includes(language)) {
        selectedTags.value = selectedTags.value.filter(
          x => x !== language,
        );
        excludedTags.value.push(language);
      } else if (excludedTags.value.includes(language)) {
        excludedTags.value = excludedTags.value.filter(
          x => x !== language,
        );
      } else {
        selectedTags.value.push(language);
      }
    };

    return {
      categories,
      tabs,
      visibleTabs,
      keywordGroups,
      keywordSearch,
      loading,
      selectedTags,
      excludedTags,
      keywordOperator,
      selectedTab,
      categoriesWithSelections,
      filteredKeywordGroupView,
      getKeywordGroupCategories,
      getMvKeywordGroup,
      saveKeywordToGroup,
      toggleLanguage,
    };
  },
);
