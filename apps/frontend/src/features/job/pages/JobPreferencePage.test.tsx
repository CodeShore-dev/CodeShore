import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { useJobFilterStore } from '../jobFilterStore';
import { useKeywordFilterStore } from '../../keyword/keywordFilterStore';

vi.mock('../service', () => ({
  DEFAULT_JOB_ORDERS: 'avg_salary:desc',
  fetchJobs: vi.fn().mockResolvedValue({
    result: [
      {
        id: 'job-1',
        title: 'React 資深工程師',
        company_name: 'Acme 科技',
        location: '台北',
        salary: '面議',
        closed: false,
        detail_link: 'https://example.com/1',
        updated_at: '2026-06-23T00:00:00Z',
        description: '',
        tech_mappings: [],
      },
      {
        id: 'job-2',
        title: 'Vue 前端工程師',
        company_name: 'Globex 公司',
        location: '新竹',
        salary: '面議',
        closed: false,
        detail_link: 'https://example.com/2',
        updated_at: '2026-06-23T00:00:00Z',
        description: '',
        tech_mappings: [],
      },
    ],
    count: 2,
  }),
  fetchJobPreferencedCount: vi
    .fn()
    .mockResolvedValue({ liked_count: 7, disliked_count: 5 }),
  fetchLocationGroups: vi.fn().mockResolvedValue({ result: [] }),
  setJobPreference: vi.fn().mockResolvedValue({}),
  clearJobPreferences: vi.fn().mockResolvedValue({}),
  createCrawlEventSource: vi.fn(() => ({ close: vi.fn() })),
}));

vi.mock('../../home/service', () => ({
  fetchMvSalaryTypeMedianRatio: vi.fn().mockResolvedValue({ result: [] }),
  fetchMvSalaryRangeMultiplier: vi.fn().mockResolvedValue({ result: [] }),
  fetchJobCount: vi.fn().mockResolvedValue([
    {
      jobs: 200,
      open_jobs: 100,
      month_salary_type_jobs: 10,
      year_salary_type_jobs: 20,
    },
  ]),
}));

vi.mock('../../keyword/service', () => ({
  fetchMvTech: vi.fn().mockResolvedValue({ result: [] }),
  fetchTechCategories: vi.fn().mockResolvedValue({ result: [] }),
  updateTech: vi.fn().mockResolvedValue(undefined),
}));

import { JobPreferencePage } from './JobPreferencePage';

beforeEach(() => {
  useJobFilterStore.getState().reset();
  useKeywordFilterStore.getState().reset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('JobPreferencePage', () => {
  it('renders the job list, filter sidebar, and preference tabs (req 3.1)', async () => {
    renderWithProviders(<JobPreferencePage />, { route: '/jobs' });

    expect(
      await screen.findByText('React 資深工程師'),
    ).toBeInTheDocument();
    expect(screen.getByText('Vue 前端工程師')).toBeInTheDocument();
    expect(screen.getByText('總數')).toBeInTheDocument();
    expect(screen.getByText('喜歡')).toBeInTheDocument();
    expect(screen.getByText('不喜歡')).toBeInTheDocument();
    expect(screen.getAllByText('篩選條件').length).toBeGreaterThan(0);
  });

  it('derives the liked / disliked tab counts from the count query (req 3.3)', async () => {
    renderWithProviders(<JobPreferencePage />, { route: '/jobs' });

    // liked_count / disliked_count come straight from the preference count query.
    expect(await screen.findByText('7')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('opens the detail drawer with the original-platform handoff (req 3.5)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<JobPreferencePage />, { route: '/jobs' });

    await user.click(await screen.findByText('React 資深工程師'));

    // The drawer mounts the full job card subtree incl. the handoff CTA.
    expect(await screen.findByText('前往原始職缺')).toBeInTheDocument();
    const handoff = screen.getByRole('link', { name: /前往原始職缺/ });
    expect(handoff).toHaveAttribute('href', 'https://example.com/1');
  });
});

describe('JobPreferencePage filtering', () => {
  it('marks active filters and supports clearing them (req 3.2)', async () => {
    const user = userEvent.setup();
    useJobFilterStore.getState().setSearchText('react');

    renderWithProviders(<JobPreferencePage />, { route: '/jobs' });

    // The active-filter chip bar surfaces the search filter.
    expect(await screen.findByText('react')).toBeInTheDocument();

    await user.click(screen.getByText('清除全部'));

    expect(useJobFilterStore.getState().searchText).toBe('');
  });
});
