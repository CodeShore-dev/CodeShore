import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('../../keyword/service', () => ({
  fetchMvTech: vi.fn().mockResolvedValue({ result: [] }),
  fetchTechCategories: vi.fn().mockResolvedValue({ result: [] }),
  updateTech: vi.fn().mockResolvedValue(undefined),
}));

import { JobSwipeCard } from './JobSwipeCard';

const noopHandlers = {
  onPointerDown: vi.fn(),
  onPointerMove: vi.fn(),
  onPointerUp: vi.fn(),
  onPointerCancel: vi.fn(),
};

// Fly-out stamp entrance transition (task 5.1): the stamp mounts with
// "entering" classes (scale-75 opacity-0) and flips to "entered" classes
// (scale-100 opacity-100) on the next tick, independent of the card's own
// translateX/opacity transition (`cardStyle`).
describe('JobSwipeCard - fly-out stamp entrance transition (Req 5.1, 5.3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the stamp with entering classes on mount, then flips to entered classes', () => {
    renderWithProviders(
      <JobSwipeCard
        job={undefined}
        cardStyle={{}}
        flying="like"
        handlers={noopHandlers}
        loading
        crawl={{
          start: vi.fn(),
          progress: [],
          done: false,
          crawlJobId: null,
        }}
      />,
    );

    const stamp = screen.getByText('已喜歡').parentElement as HTMLElement;

    expect(stamp.className).toContain('scale-75');
    expect(stamp.className).toContain('opacity-0');
    expect(stamp.className).not.toContain('scale-100');

    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(stamp.className).toContain('scale-100');
    expect(stamp.className).toContain('opacity-100');
    expect(stamp.className).not.toContain('scale-75');
  });

  it('shows the dislike stamp with the same entrance transition treatment', () => {
    renderWithProviders(
      <JobSwipeCard
        job={undefined}
        cardStyle={{}}
        flying="dislike"
        handlers={noopHandlers}
        loading
        crawl={{
          start: vi.fn(),
          progress: [],
          done: false,
          crawlJobId: null,
        }}
      />,
    );

    const stamp = screen.getByText('已不喜歡').parentElement as HTMLElement;
    expect(stamp.className).toContain('scale-75');
    expect(stamp.className).toContain('opacity-0');

    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(stamp.className).toContain('scale-100');
    expect(stamp.className).toContain('opacity-100');
  });

  it('does not render the stamp when flying is null', () => {
    renderWithProviders(
      <JobSwipeCard
        job={undefined}
        cardStyle={{}}
        flying={null}
        handlers={noopHandlers}
        loading
        crawl={{
          start: vi.fn(),
          progress: [],
          done: false,
          crawlJobId: null,
        }}
      />,
    );

    expect(screen.queryByText('已喜歡')).not.toBeInTheDocument();
    expect(screen.queryByText('已不喜歡')).not.toBeInTheDocument();
  });
});
