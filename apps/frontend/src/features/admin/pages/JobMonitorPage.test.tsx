import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { useAdminStore } from '../adminStore';

// Mock the admin service layer (network calls) so the page's real query hooks
// (useCrawlStatsQuery / useSalaryAnomaliesQuery / etc.) resolve to empty data
// instead of hitting httpClient. Mirrors the ../service mocking convention used
// in job-filter-watchlist/pages/JobFilterWatchlistPage.test.tsx.
vi.mock('../service', () => ({
  fetchCrawlStats: vi.fn().mockResolvedValue({
    new_jobs_date: '',
    new_jobs_count: 0,
    updated_jobs_date: '',
    updated_jobs_count: 0,
  }),
  fetchSalaryAnomalies: vi.fn().mockResolvedValue({ result: [], count: 0 }),
  fetchEmptyDescriptionJobs: vi.fn().mockResolvedValue({ result: [], count: 0 }),
  fetchLocationAnomalies: vi.fn().mockResolvedValue({ result: [], count: 0 }),
  fetchUpdateDateCounts: vi.fn().mockResolvedValue([]),
  updateJobSalary: vi.fn().mockResolvedValue(undefined),
  createAdminCrawlEventSource: vi.fn(),
  createMvRefreshEventSource: vi.fn(),
}));

import { JobMonitorPage } from './JobMonitorPage';

// JobMonitorPage condition-builder (task 4.1, requirement 4.1, design.md §6.4):
// the "which jobs need re-crawling" condition builder must default to
// crawled_at (crawl-time) rather than updated_at (content-change time), while
// still exposing updated_at as a selectable manual-filter option.
describe('JobMonitorPage condition builder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAdminStore.setState({
      statsDays: 7,
      salaryThreshold: { monthCeil: 300000, yearCeil: 9999999 },
      locationMaxLen: 30,
      salaryPage: 1,
      emptyPage: 1,
      selectedDates: [],
      selectedLocationGroups: [],
    });
  });

  it('defaults the initial condition row column to crawled_at (req 4.1)', () => {
    renderWithProviders(<JobMonitorPage />);

    const columnSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    expect(columnSelect.value).toBe('crawled_at');
  });

  it('offers both crawled_at and updated_at as column options (design.md §6.4)', () => {
    renderWithProviders(<JobMonitorPage />);

    const columnSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    const optionValues = within(columnSelect)
      .getAllByRole('option')
      .map(o => (o as HTMLOptionElement).value);

    expect(optionValues).toContain('crawled_at');
    expect(optionValues).toContain('updated_at');
  });

  it('defaults a newly added condition row to crawled_at', async () => {
    renderWithProviders(<JobMonitorPage />);

    await userEvent.click(
      screen.getByRole('button', { name: '＋ 新增條件' }),
    );

    const columnSelects = screen
      .getAllByRole('combobox')
      .filter((el): el is HTMLSelectElement => el.tagName === 'SELECT')
      // Column selects come first in each condition row; with 2 rows x 2
      // selects (column, operator) each, indices 0 and 2 are the columns.
      .filter((_, idx) => idx % 2 === 0);

    expect(columnSelects).toHaveLength(2);
    expect(columnSelects[0].value).toBe('crawled_at');
    expect(columnSelects[1].value).toBe('crawled_at');
  });

  it('adds a crawled_at condition via the "快速：N 天未更新" quick-add button', async () => {
    renderWithProviders(<JobMonitorPage />);

    await userEvent.click(screen.getByRole('button', { name: '加入' }));

    const preview = screen
      .getByText('where 預覽：')
      .parentElement?.querySelector('code');
    expect(preview?.textContent).toMatch(/crawled_at\.lt\./);
  });
});
