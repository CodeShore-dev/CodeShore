import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SubscriptionWithCounts } from '../service';
import { JobFilterWatchlistItem } from './JobFilterWatchlistItem';

const baseSubscription: SubscriptionWithCounts = {
  id: 'sub-1',
  label: '技術：React・薪資 60k+',
  filterSnapshot: {
    searchText: '',
    companyFilters: [],
    salaryFilter: 'none',
    salaryAmount: { type: '', amount: null },
    selectedLocations: [],
    selectedTags: [],
    excludedTags: [],
    techOperator: 'and',
  },
  lastViewedAt: '2026-07-10T00:00:00.000Z',
  createdAt: '2026-07-01T00:00:00.000Z',
  totalCount: 42,
  newCount: 0,
};

// Single followed-filter-combination row (task 4.2, design.md's
// JobFilterWatchlistItem, requirements 2.2, 4.1).
describe('JobFilterWatchlistItem', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders label, totalCount, and lastViewedAt info', () => {
    render(
      <JobFilterWatchlistItem
        subscription={baseSubscription}
        onView={() => {}}
        onUnfollow={() => {}}
      />,
    );

    expect(screen.getByText('技術：React・薪資 60k+')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText(/上次查看：/)).toBeInTheDocument();
  });

  it('renders lastViewedAt as a plain relative time, with no crawl-specific "重爬" suffix', () => {
    // lastViewedAt is the user's own last-viewed action, not a job
    // re-crawl timestamp -- formatDateInfo's hardcoded "重爬" suffix does
    // not apply here. Fake timers pin "now" so the day bucket is exact.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T00:00:00.000Z'));

    render(
      <JobFilterWatchlistItem
        subscription={baseSubscription}
        onView={() => {}}
        onUnfollow={() => {}}
      />,
    );

    expect(screen.getByText('上次查看：3 天前')).toBeInTheDocument();
    expect(screen.queryByText(/重爬/)).not.toBeInTheDocument();
  });

  it('shows a plain "沒有新職缺" message, with no emphasis badge, when newCount is 0', () => {
    render(
      <JobFilterWatchlistItem
        subscription={baseSubscription}
        onView={() => {}}
        onUnfollow={() => {}}
      />,
    );

    expect(screen.getByText('沒有新職缺')).toBeInTheDocument();
    expect(screen.queryByText(/個新職缺/)).not.toBeInTheDocument();
  });

  it('renders newCount with visual emphasis when newCount > 0', () => {
    render(
      <JobFilterWatchlistItem
        subscription={{ ...baseSubscription, newCount: 5 }}
        onView={() => {}}
        onUnfollow={() => {}}
      />,
    );

    const badge = screen.getByText('5 個新職缺');
    expect(badge).toBeInTheDocument();
    // Emphasis check: the new-count badge uses the app's accent fill
    // (bg-[#003d92] + white text), unlike the plain "沒有新職缺" text.
    expect(badge.className).toContain('bg-[#003d92]');
    expect(badge.className).toContain('text-white');
    expect(screen.queryByText('沒有新職缺')).not.toBeInTheDocument();
  });

  it('calls onView when the item body is clicked and onUnfollow when the unfollow button is clicked', async () => {
    const onView = vi.fn();
    const onUnfollow = vi.fn();
    const user = userEvent.setup();
    render(
      <JobFilterWatchlistItem
        subscription={baseSubscription}
        onView={onView}
        onUnfollow={onUnfollow}
      />,
    );

    await user.click(screen.getByText('技術：React・薪資 60k+'));
    expect(onView).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: '取消關注' }));
    expect(onUnfollow).toHaveBeenCalledTimes(1);
  });
});
