import { type VueWrapper, mount } from '@vue/test-utils';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import JobFilterSidebar from './components/JobFilterSidebar.vue';
import JobPreference from './views/JobPreference.vue';

// job store 以最小 stub 取代，避免 Pinia 與真實資料/網路相依
vi.mock('./useJobStore', () => ({
  useJobStore: () => ({
    countText: { total: '0', liked: '0', disliked: '0' },
    listViewPreference: null,
    listTotalCountText: '0',
    listSort: 'salary',
    loading: false,
    salaryFilter: 'none',
    salaryAmountFilter: { type: '', amount: null },
    searchText: '',
    companySearchText: '',
    selectedLocations: [],
    locationGroups: [],
    locationGroupsLoading: false,
    exitListView: vi.fn(),
    fetchListJobs: vi.fn(),
    clearPreferences: vi.fn(),
    setListSort: vi.fn(),
  }),
}));

// keyword store 以最小 stub 取代
vi.mock('../keyword/useKeywordStore', () => ({
  useKeywordStore: () => ({
    selectedTags: [],
    excludedTags: [],
    keywordOperator: 'and',
    keywordSearch: '',
    selectedTab: '',
    tabs: [],
  }),
}));

// home store 以最小 stub 取代
vi.mock('../home/useHomeStore', () => ({
  useHomeStore: () => ({
    getJobCount: vi.fn(),
  }),
}));

// URL 同步 composable 以最小 stub 取代，避免 vue-router 相依
vi.mock('./composables/useJobUrlSync', () => ({
  useJobUrlSync: () => ({ selectedJobId: { value: null } }),
}));

// 以簡單 stub 取代 InfoHint，曝露其 metric prop 供斷言
const InfoHintStub = {
  name: 'InfoHint',
  props: ['metric'],
  template:
    '<span data-testid="info-hint" :data-metric="metric" />',
};

const RouterLinkStub = {
  name: 'RouterLink',
  props: ['to'],
  template: '<a><slot /></a>',
};

const SearchInputStub = {
  name: 'SearchInput',
  props: ['modelValue', 'placeholder'],
  template: '<input />',
};

const JobKeywordFilterPanelStub = {
  name: 'JobKeywordFilterPanel',
  template: '<div />',
};

const JobActiveFiltersStub = {
  name: 'JobActiveFilters',
  template: '<div />',
};

const JobListStub = {
  name: 'JobList',
  props: ['hasActiveFilters', 'selectedJobId'],
  template: '<div />',
};

const JobFilterSidebarStub = {
  name: 'JobFilterSidebar',
  template: '<div />',
};

function metricsOf(wrapper: VueWrapper) {
  return wrapper
    .findAll('[data-testid="info-hint"]')
    .map(node => node.attributes('data-metric'));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Job page embeds InfoHint', () => {
  it('JobPreference 分析/列表區塊 → job.list', () => {
    const wrapper = mount(JobPreference, {
      global: {
        stubs: {
          InfoHint: InfoHintStub,
          RouterLink: RouterLinkStub,
          JobActiveFilters: JobActiveFiltersStub,
          JobList: JobListStub,
          JobFilterSidebar: JobFilterSidebarStub,
        },
      },
    });
    expect(metricsOf(wrapper)).toContain('job.list');
  });

  it('JobFilterSidebar 薪資區塊 → job.salary', () => {
    const wrapper = mount(JobFilterSidebar, {
      global: {
        stubs: {
          InfoHint: InfoHintStub,
          RouterLink: RouterLinkStub,
          SearchInput: SearchInputStub,
          JobKeywordFilterPanel: JobKeywordFilterPanelStub,
        },
      },
    });
    expect(metricsOf(wrapper)).toContain('job.salary');
  });
});
