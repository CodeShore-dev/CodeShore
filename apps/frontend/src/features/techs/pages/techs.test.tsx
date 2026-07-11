import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';

// Defined via vi.hoisted so they are available inside the hoisted vi.mock
// factory below.
const { rankingItem, comboItem } = vi.hoisted(() => ({
  rankingItem: {
    tech: 'react',
    label: 'React',
    icon_slugs: [],
    tags: [],
    job_count: 100,
    year_median_avg: 1200000,
    year_pr75_avg: 1500000,
    year_pr88_avg: 2000000,
    month_median_avg: 80000,
    month_pr75_avg: 100000,
    month_pr88_avg: 140000,
  },
  comboItem: {
    tech1: 'react',
    tech2: 'node',
    tech1_label: 'React',
    tech2_label: 'Node.js',
    tech1_icons: [],
    tech2_icons: [],
    tech2_tags: [],
    job_count: 50,
    median_min_year: 1000000,
    median_max_year: 1400000,
    pr75_min_year: 1200000,
    pr75_max_year: 1600000,
    pr88_min_year: 1500000,
    pr88_max_year: 2000000,
    median_min_month: 70000,
    median_max_month: 90000,
    pr75_min_month: 85000,
    pr75_max_month: 105000,
    pr88_min_month: 100000,
    pr88_max_month: 140000,
  },
}));

vi.mock('../../home/service', () => ({
  fetchMvTechRanking: vi
    .fn()
    .mockResolvedValue({ result: [rankingItem], count: 1 }),
  fetchMvTechComboStats: vi
    .fn()
    .mockResolvedValue({ result: [comboItem], count: 1 }),
  fetchMvSalaryTypeMedianRatio: vi.fn().mockResolvedValue({ result: [] }),
  fetchMvSalaryRangeMultiplier: vi.fn().mockResolvedValue({ result: [] }),
  fetchJobCount: vi.fn().mockResolvedValue([
    {
      jobs: 0,
      open_jobs: 0,
      month_salary_type_jobs: 0,
      year_salary_type_jobs: 0,
    },
  ]),
}));

import { TechsPage } from './TechsPage';

describe('TechsPage SEO (req 2.1, 2.2, 2.3, 3.1, 3.2, 5.3)', () => {
  it('sets the document title with the site suffix (req 2.1)', () => {
    renderWithProviders(<TechsPage />, { route: '/techs' });
    expect(document.title).toBe('技術熱度統計 | 碼的 上岸了');
  });

  it('renders a BreadcrumbList JSON-LD pointing at home and the techs page (req 5.3)', () => {
    const { container } = renderWithProviders(<TechsPage />, {
      route: '/techs',
    });
    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(script).not.toBeNull();

    const parsed = JSON.parse(script?.innerHTML ?? '');
    expect(parsed).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: '首頁',
          item: 'https://codeshore.dev/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: '技術熱度',
          item: 'https://codeshore.dev/techs',
        },
      ],
    });
  });
});

describe('TechsPage', () => {
  it('renders the popular heading and ranking items', async () => {
    renderWithProviders(<TechsPage />);
    expect(screen.getByText('最多職缺要的技術')).toBeInTheDocument();
    expect(await screen.findByText('React')).toBeInTheDocument();
  });

  it('switches heading when a salary mode is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TechsPage />);
    await screen.findByText('React');

    await user.click(screen.getByText('高薪 · 年薪'));

    expect(screen.getByText('開最高薪的技術')).toBeInTheDocument();
  });

  it('switches to the combos tab and shows combos across all categories by default', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TechsPage />);
    await screen.findByText('React');

    await user.click(screen.getByText('技術組合'));

    expect(
      screen.getByText('最常一起出現的技術組合'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Node.js')).toBeInTheDocument();
    // Default category filter is "全部" (all) when entering combos.
    expect(screen.getByText('全部')).toBeInTheDocument();
  });
});
