import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

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
  fetchMvSalaryWeightedRatio: vi.fn().mockResolvedValue({
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
}));

import { HomeSalaryBenchmark } from '../components/HomeSalaryBenchmark';
import { HomePage } from './HomePage';

describe('HomePage', () => {
  it('renders the hero and the hot-combos section heading (req 8.1)', async () => {
    renderWithProviders(<HomePage />);
    expect(screen.getByText('個職缺(含關閉職缺)')).toBeInTheDocument();
    expect(
      screen.getByText('職缺裡最常同時出現的技術組合'),
    ).toBeInTheDocument();
    // Flush async query updates so they are wrapped in act().
    expect(await screen.findByText('5,000')).toBeInTheDocument();
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
