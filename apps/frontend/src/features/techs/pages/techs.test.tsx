import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';

// Defined via vi.hoisted so they are available inside the hoisted vi.mock
// factory below.
const { rankingItem, comboItem } = vi.hoisted(() => ({
  rankingItem: {
    keyword_group: 'react',
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
    median_min_month: 70000,
    median_max_month: 90000,
  },
}));

vi.mock('../../home/service', () => ({
  fetchMvKeywordGroupRanking: vi
    .fn()
    .mockResolvedValue({ result: [rankingItem], count: 1 }),
  fetchMvTechComboStats: vi
    .fn()
    .mockResolvedValue({ result: [comboItem], count: 1 }),
  fetchMvSalaryTypeMedianRatio: vi.fn().mockResolvedValue({ result: [] }),
  fetchMvSalaryWeightedRatio: vi.fn().mockResolvedValue({ result: [] }),
  fetchJobCount: vi.fn().mockResolvedValue([
    {
      jobs: 0,
      open_jobs: 0,
      month_salary_type_jobs: 0,
      year_salary_type_jobs: 0,
    },
  ]),
}));

import { TechCombosPage } from './TechCombosPage';
import { TechRankingPage } from './TechRankingPage';

describe('TechRankingPage', () => {
  it('renders the popular heading and ranking items (req 5.1)', async () => {
    renderWithProviders(<TechRankingPage />);
    expect(screen.getByText('最多職缺要的技術')).toBeInTheDocument();
    expect(await screen.findByText('React')).toBeInTheDocument();
  });

  it('switches heading when a salary mode is selected (req 5.3)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TechRankingPage />);
    await screen.findByText('React');

    await user.click(screen.getByText('高薪 · 年薪'));

    expect(screen.getByText('開最高薪的技術')).toBeInTheDocument();
  });
});

describe('TechCombosPage', () => {
  it('renders language chips and combos for the selected tech (req 5.2)', async () => {
    renderWithProviders(<TechCombosPage />);
    // Language chip + combo partner both render after async load.
    expect(await screen.findByText('Node.js')).toBeInTheDocument();
    expect(screen.getAllByText('React').length).toBeGreaterThan(0);
  });
});
