import { type VueWrapper, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import HomeHighSalaryTech from './HomeHighSalaryTech.vue';
import HomeHotCombos from './HomeHotCombos.vue';
import HomePopularTech from './HomePopularTech.vue';
import HomeSalaryBenchmark from './HomeSalaryBenchmark.vue';
import HomeStatRow from './HomeStatRow.vue';

// 服務層全部以空結果 stub，避免真實網路請求並讓 store/composable 初始化無副作用
vi.mock('../service', () => ({
  fetchMvSalaryTypeMedianRatio: vi.fn(async () => ({
    result: [],
  })),
  fetchMvSalaryWeightedRatio: vi.fn(async () => ({
    result: [],
  })),
  fetchJobCount: vi.fn(async () => [
    {
      jobs: 0,
      open_jobs: 0,
      month_salary_type_jobs: 0,
      year_salary_type_jobs: 0,
    },
  ]),
  fetchMvKeywordGroupRanking: vi.fn(async () => ({
    result: [],
  })),
  fetchMvTechComboStats: vi.fn(async () => ({
    result: [],
  })),
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

// 宿主以 InfoHint 作為 card-list 的兄弟節點（非 slot），stub 僅需渲染預設 slot
const KeywordTechRankingCardListStub = {
  name: 'KeywordTechRankingCardList',
  props: [
    'title',
    'items',
    'loading',
    'getItems',
    'moreTo',
  ],
  template: '<div><slot /></div>',
};

const globalStubs = {
  InfoHint: InfoHintStub,
  RouterLink: RouterLinkStub,
  TechIcon: TechIconStub,
  KeywordTechRankingCardList:
    KeywordTechRankingCardListStub,
};

function metricsOf(wrapper: VueWrapper) {
  return wrapper
    .findAll('[data-testid="info-hint"]')
    .map(node => node.attributes('data-metric'));
}

const mocks = {
  $router: { push: vi.fn() },
  $route: { query: {} },
};

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('Home analytical sections embed InfoHint', () => {
  it('HomeStatRow → home.statRow', () => {
    const wrapper = mount(HomeStatRow, {
      props: { loading: false },
      global: { stubs: globalStubs, mocks },
    });
    expect(metricsOf(wrapper)).toContain('home.statRow');
  });

  it('HomeSalaryBenchmark → home.salaryBenchmark', () => {
    const wrapper = mount(HomeSalaryBenchmark, {
      props: { loading: false },
      global: { stubs: globalStubs, mocks },
    });
    expect(metricsOf(wrapper)).toContain(
      'home.salaryBenchmark',
    );
  });

  it('HomePopularTech → home.popularTech', () => {
    const wrapper = mount(HomePopularTech, {
      global: { stubs: globalStubs, mocks },
    });
    expect(metricsOf(wrapper)).toContain(
      'home.popularTech',
    );
  });

  it('HomeHighSalaryTech type="year" → home.highSalaryTech.year', () => {
    const wrapper = mount(HomeHighSalaryTech, {
      props: { type: 'year' },
      global: { stubs: globalStubs, mocks },
    });
    expect(metricsOf(wrapper)).toContain(
      'home.highSalaryTech.year',
    );
  });

  it('HomeHighSalaryTech type="month" → home.highSalaryTech.month', () => {
    const wrapper = mount(HomeHighSalaryTech, {
      props: { type: 'month' },
      global: { stubs: globalStubs, mocks },
    });
    expect(metricsOf(wrapper)).toContain(
      'home.highSalaryTech.month',
    );
  });

  it('HomeHotCombos → home.hotCombos', () => {
    const wrapper = mount(HomeHotCombos, {
      props: { tech: 'java' },
      global: { stubs: globalStubs, mocks },
    });
    expect(metricsOf(wrapper)).toContain('home.hotCombos');
  });
});
