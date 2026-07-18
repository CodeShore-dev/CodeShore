import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { AnomalyJob } from '../service';
import { AnomalyTable } from './AnomalyTable';

// Requirement 4.3 / design.md §6.4: admin anomaly tables track crawl
// activity, not content-change time, so the "更新時間" column must display
// `crawled_at` (last crawl time) rather than `updated_at` (last real content
// change time). Fake job with distinct values for the two fields lets the
// test tell them apart.
const makeJob = (overrides: Partial<AnomalyJob> = {}): AnomalyJob =>
  ({
    id: 'job-1',
    title: 'Anomaly Job',
    detail_link: 'https://example.com/job-1',
    crawled_at: '2024-06-15',
    updated_at: '2019-01-01',
    ...overrides,
  }) as AnomalyJob;

describe('AnomalyTable', () => {
  it('displays crawled_at (crawl time), not updated_at (real change time), in the time column', () => {
    render(
      <AnomalyTable
        title="異常"
        icon="warning"
        count={1}
        loading={false}
        items={[makeJob()]}
        page={1}
        valueColumn="none"
        crawlRunning={false}
        onPageChange={vi.fn()}
        onRecrawlRow={vi.fn()}
        onRecrawlBulk={vi.fn()}
      />,
    );

    expect(screen.getByText('2024-06-15')).toBeInTheDocument();
    expect(screen.queryByText('2019-01-01')).not.toBeInTheDocument();
  });
});
