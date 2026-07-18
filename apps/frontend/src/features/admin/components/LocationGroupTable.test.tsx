import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { LocationGroupRow } from '../queries';
import type { AnomalyJob } from '../service';
import { LocationGroupTable } from './LocationGroupTable';

// Requirement 4.3 / design.md §6.4: same field-source change as
// AnomalyTable — the per-job time shown when a location group is expanded
// must be `crawled_at` (crawl time), not `updated_at` (real content-change
// time). Distinct fake values for the two fields let the test distinguish
// which one is actually rendered.
const makeJob = (overrides: Partial<AnomalyJob> = {}): AnomalyJob =>
  ({
    id: 'job-1',
    title: 'Anomaly Job',
    detail_link: 'https://example.com/job-1',
    location: '未知地點',
    crawled_at: '2024-06-15',
    updated_at: '2019-01-01',
    ...overrides,
  }) as AnomalyJob;

const makeGroups = (): LocationGroupRow[] => [
  {
    key: '未知地點',
    location: '未知地點',
    count: 1,
    jobs: [makeJob()],
  },
];

describe('LocationGroupTable', () => {
  it('displays crawled_at (crawl time), not updated_at (real change time), for jobs in an expanded group', async () => {
    const user = userEvent.setup();
    render(
      <LocationGroupTable
        groups={makeGroups()}
        selectedKeys={[]}
        loading={false}
        crawlRunning={false}
        onToggle={vi.fn()}
        onToggleAll={vi.fn()}
        onRecrawlSelected={vi.fn()}
      />,
    );

    // Rows start collapsed; expand by clicking the group row (location text).
    await user.click(screen.getByText('未知地點'));

    expect(screen.getByText(/2024-06-15/)).toBeInTheDocument();
    expect(screen.queryByText(/2019-01-01/)).not.toBeInTheDocument();
  });
});
