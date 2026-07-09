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
