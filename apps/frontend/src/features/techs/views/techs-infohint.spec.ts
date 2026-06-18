import { type VueWrapper, mount } from '@vue/test-utils';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import TechCombos from './TechCombos.vue';
import TechRanking from './TechRanking.vue';

// 服務層以空結果 stub，避免真實網路請求並讓 composable 初始化無副作用
vi.mock('../../home/service', () => ({
  fetchMvKeywordGroupRanking: vi.fn(async () => ({
    result: [],
    count: 0,
  })),
  fetchMvTechComboStats: vi.fn(async () => ({
    result: [],
    count: 0,
  })),
  fetchMvSalaryTypeMedianRatio: vi.fn(async () => ({
    result: [],
  })),
}));

// vue-router composables 以最小 stub 取代（views 使用 useRoute/useRouter）
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// home store 以最小 stub 取代，避免 Pinia 與真實資料相依
vi.mock('../../home/useHomeStore', () => ({
  useHomeStore: () => ({
    salaryTypeMedianRatio: [],
    salaryBenchmarks: {
      year: { median: 0 },
      month: { median: 0 },
    },
    getMvSalaryTypeMedianRatio: vi.fn(async () => {}),
  }),
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

const TechIconStub = {
  name: 'TechIcon',
  props: ['slugs', 'label'],
  template: '<i />',
};

const TechRankingCardStub = {
  name: 'TechRankingCard',
  props: ['item', 'rank', 'mode'],
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
  TechIcon: TechIconStub,
  TechRankingCard: TechRankingCardStub,
  Pagination: PaginationStub,
};

const mocks = {
  $router: { push: vi.fn(), replace: vi.fn() },
  $route: { query: {} },
};

function metricsOf(wrapper: VueWrapper) {
  return wrapper
    .findAll('[data-testid="info-hint"]')
    .map(node => node.attributes('data-metric'));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Tech analytical views embed InfoHint', () => {
  it('TechRanking → techs.ranking', () => {
    const wrapper = mount(TechRanking, {
      global: {
        stubs: globalStubs,
        mocks,
      },
    });
    expect(metricsOf(wrapper)).toContain('techs.ranking');
  });

  it('TechCombos → techs.combos', () => {
    const wrapper = mount(TechCombos, {
      global: {
        stubs: globalStubs,
        mocks,
      },
    });
    expect(metricsOf(wrapper)).toContain('techs.combos');
  });
});
