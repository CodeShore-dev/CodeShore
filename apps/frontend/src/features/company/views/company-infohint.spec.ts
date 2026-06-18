import { type VueWrapper, mount } from '@vue/test-utils';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import CompanyList from './CompanyList.vue';

// company store 以最小 stub 取代，避免 Pinia 與真實資料/網路相依
vi.mock('../useCompanyStore', () => ({
  useCompanyStore: () => ({
    companies: [],
    totalCount: 0,
    currentPage: 1,
    totalPages: 1,
    loading: false,
    search: '',
    selectedKeywordGroups: [],
    hasActiveFilters: false,
    loadCompanies: vi.fn(async () => {}),
    clearFilters: vi.fn(),
    goToPage: vi.fn(),
  }),
}));

// keyword store 以最小 stub 取代
vi.mock('../../keyword/useKeywordStore', () => ({
  useKeywordStore: () => ({
    keywordGroups: [],
    tabs: [],
  }),
}));

// vue-router composables 以最小 stub 取代
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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

const CompanyCardStub = {
  name: 'CompanyCard',
  props: [
    'company',
    'keywordGroups',
    'categoryLabelMap',
    'selectedKeywordGroups',
  ],
  template: '<div />',
};

const CompanyKeywordFilterStub = {
  name: 'CompanyKeywordFilter',
  template: '<div />',
};

const PaginationStub = {
  name: 'Pagination',
  props: ['currentPage', 'totalPages'],
  template: '<div />',
};

const globalStubs = {
  InfoHint: InfoHintStub,
  RouterLink: RouterLinkStub,
  CompanyCard: CompanyCardStub,
  CompanyKeywordFilter: CompanyKeywordFilterStub,
  Pagination: PaginationStub,
};

const mocks = {
  $router: { push: vi.fn(), replace: vi.fn() },
};

function metricsOf(wrapper: VueWrapper) {
  return wrapper
    .findAll('[data-testid="info-hint"]')
    .map(node => node.attributes('data-metric'));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Company list view embeds InfoHint', () => {
  it('CompanyList → company.list', () => {
    const wrapper = mount(CompanyList, {
      global: {
        stubs: globalStubs,
        mocks,
      },
    });
    expect(metricsOf(wrapper)).toContain('company.list');
  });
});
