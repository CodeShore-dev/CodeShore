import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('../service', () => ({
  fetchMvSalaryTypeMedianRatio: vi.fn().mockResolvedValue({
    result: [
      {
        salary_type: 'year',
        median_mark: 1200000,
        high_mark: 1500000,
        top_mark: 2000000,
      },
      {
        salary_type: 'month',
        median_mark: 80000,
        high_mark: 100000,
        top_mark: 140000,
      },
    ],
  }),
  fetchMvSalaryRangeMultiplier: vi.fn().mockResolvedValue({
    result: [
      { salary_type: 'year', ratio: 1.5 },
      { salary_type: 'month', ratio: 1.2 },
    ],
  }),
  fetchJobCount: vi.fn().mockResolvedValue([
    {
      jobs: 5000,
      open_jobs: 3000,
      month_salary_type_jobs: 1000,
      year_salary_type_jobs: 2000,
    },
  ]),
  fetchMvTechRanking: vi.fn().mockResolvedValue({ result: [] }),
  fetchMvTechComboStats: vi.fn().mockResolvedValue({ result: [] }),
  fetchJobHostStatistics: vi.fn().mockResolvedValue([
    { host: 'www.104.com.tw', host_count: 9325, percentage: 83.83 },
    { host: 'www.cake.me', host_count: 1799, percentage: 16.17 },
  ]),
}));

import { ListQuery } from '../../../@types';
import { HomeSalaryBenchmark } from '../components/HomeSalaryBenchmark';
import { fetchMvTechComboStats, fetchMvTechRanking } from '../service';
import { HomePage } from './HomePage';

// issue #24：技術組合區塊改成四個分類各取 5 個，不再跟著「熱門技術」的
// 分類按鈕走。以 `to` 區分兩種請求：組合來源取 top 5（to: 4），排行榜取
// top 10（to: 9）。
const COMBO_RANKING: Record<string, string[]> = {
  language: ['java', 'python', 'go', 'ruby', 'php'],
  framework: ['react', 'vue'],
  database: ['postgresql'],
  library: ['lodash'],
};

const TECH_LABEL: Record<string, string> = {
  java: 'Java',
  python: 'Python',
  go: 'Go',
  ruby: 'Ruby',
  php: 'PHP',
  react: 'React',
  vue: 'Vue',
  postgresql: 'PostgreSQL',
  lodash: 'Lodash',
};

function whereOf(query?: ListQuery): Record<string, { eq?: string }> {
  return JSON.parse(String(query?.where ?? '{}'));
}

function mockComboSources(): void {
  vi.mocked(fetchMvTechRanking).mockImplementation(async (query: ListQuery) => {
    if (query.to !== 4) return { result: [] };
    const category = whereOf(query).category?.eq ?? '';
    return {
      result: (COMBO_RANKING[category] ?? []).map(tech => ({
        tech,
        label: TECH_LABEL[tech],
        category,
        job_count: 100,
        icon_slugs: [],
        tags: [],
      })),
    } as never;
  });

  vi.mocked(fetchMvTechComboStats).mockImplementation(
    async (query?: ListQuery) => {
      const tech1 = whereOf(query).tech1?.eq ?? '';
      return {
        result: [
          {
            tech1,
            tech2: 'docker',
            tech1_label: TECH_LABEL[tech1] ?? tech1,
            tech2_label: 'Docker',
            tech1_icons: [],
            tech2_icons: [],
            tech2_tags: [],
            job_count: 120,
            median_min_year: 1000000,
            median_max_year: 1400000,
            median_min_month: 70000,
            median_max_month: 90000,
          },
        ],
      } as never;
    },
  );
}

function combosSection(): HTMLElement {
  const heading = screen.getByText('職缺裡最常同時出現的技術組合');
  return heading.closest('section') as HTMLElement;
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.mocked(fetchMvTechRanking).mockReset();
    vi.mocked(fetchMvTechRanking).mockResolvedValue({ result: [] } as never);
    vi.mocked(fetchMvTechComboStats).mockReset();
    vi.mocked(fetchMvTechComboStats).mockResolvedValue({ result: [] } as never);
  });

  it('renders the hero and the hot-combos section heading (req 8.1)', async () => {
    renderWithProviders(<HomePage />);
    expect(screen.getByText('個職缺(含關閉職缺)')).toBeInTheDocument();
    expect(
      screen.getByText('職缺裡最常同時出現的技術組合'),
    ).toBeInTheDocument();
    // Flush async query updates so they are wrapped in act().
    expect(await screen.findByText('5,000')).toBeInTheDocument();
  });

  it('技術組合同時顯示四個分類，順序依 CATEGORY_PRIORITY (issue #24)', async () => {
    mockComboSources();
    renderWithProviders(<HomePage />);

    await waitFor(() =>
      expect(combosSection().textContent).toContain(
        '與 Lodash 程式庫最常同時出現的技術組合',
      ),
    );

    const text = combosSection().textContent ?? '';
    expect(text).toContain('與 Java 語言最常同時出現的技術組合');
    expect(text).toContain('與 React 框架最常同時出現的技術組合');
    expect(text).toContain('與 PostgreSQL 資料庫最常同時出現的技術組合');

    // 語言 → 框架 → 資料庫 → 程式庫
    expect(text.indexOf('與 Java')).toBeLessThan(text.indexOf('與 React'));
    expect(text.indexOf('與 React')).toBeLessThan(
      text.indexOf('與 PostgreSQL'),
    );
    expect(text.indexOf('與 PostgreSQL')).toBeLessThan(
      text.indexOf('與 Lodash'),
    );

    // 每類最多 5 個；某類不足 5 個時不補其他類（5 + 2 + 1 + 1 = 9）。
    expect(combosSection().querySelectorAll('section')).toHaveLength(9);
  });

  it('技術組合來源固定，帶 job_count >= 8 門檻 (issue #24)', async () => {
    mockComboSources();
    renderWithProviders(<HomePage />);

    await waitFor(() =>
      expect(combosSection().textContent).toContain('與 Lodash'),
    );

    const comboQueries = vi
      .mocked(fetchMvTechRanking)
      .mock.calls.map(([query]) => query)
      .filter(query => query.to === 4);
    expect(comboQueries.map(query => whereOf(query).category?.eq)).toEqual([
      'language',
      'framework',
      'database',
      'library',
    ]);
    for (const query of comboQueries) {
      expect(whereOf(query).job_count).toEqual({ gte: 8 });
    }
  });

  it('切換「熱門技術」分類時，技術組合區塊不變 (issue #24)', async () => {
    const user = userEvent.setup();
    mockComboSources();
    renderWithProviders(<HomePage />);

    await waitFor(() =>
      expect(combosSection().textContent).toContain('與 Lodash'),
    );
    const before = combosSection().textContent;

    const popularSection = screen
      .getByText('熱門技術')
      .closest('section') as HTMLElement;
    const frameworkButton = within(popularSection)
      .getAllByRole('button')
      .find(button => button.textContent === '框架');
    expect(frameworkButton).toBeDefined();
    await user.click(frameworkButton as HTMLElement);

    expect(combosSection().textContent).toBe(before);
  });

  it('sets the document title with the site suffix (req 2.1)', () => {
    renderWithProviders(<HomePage />);
    expect(document.title).toBe('台灣工程師求職市場分析 | 碼的 上岸了');
  });

  it('renders Organization and WebSite+SearchAction JSON-LD (req 5.1, 5.2)', () => {
    const { container } = renderWithProviders(<HomePage />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();

    const parsed = JSON.parse(script?.innerHTML ?? '');
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);

    const organization = parsed.find((entry: { '@type': string }) => entry['@type'] === 'Organization');
    expect(organization).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: '碼的 上岸了',
      url: 'https://codeshore.dev',
      logo: 'https://codeshore.dev/logo-512.png',
    });

    const website = parsed.find((entry: { '@type': string }) => entry['@type'] === 'WebSite');
    expect(website).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: '碼的 上岸了',
      url: 'https://codeshore.dev',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: 'https://codeshore.dev/jobs?tech={search_term_string}',
        },
        'query-input': 'required name=search_term_string',
      },
    });
  });
});

describe('HomeSalaryBenchmark', () => {
  it('toggles the weighted ratio between year and month (req 4.2)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomeSalaryBenchmark />);

    expect(await screen.findByText('1.5 倍')).toBeInTheDocument();

    await user.click(screen.getByText('月薪'));

    expect(await screen.findByText('1.2 倍')).toBeInTheDocument();
  });
});
