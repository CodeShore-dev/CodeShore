import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('../service', () => ({
  fetchLocationGroups: vi.fn().mockResolvedValue({ result: [] }),
}));

vi.mock('../../keyword/service', () => ({
  fetchMvTech: vi.fn().mockResolvedValue({ result: [] }),
  fetchTechCategories: vi.fn().mockResolvedValue({ result: [] }),
  updateTech: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../job-filter-watchlist/service', async importOriginal => {
  const actual =
    await importOriginal<typeof import('../../job-filter-watchlist/service')>();
  return { ...actual, followFilter: vi.fn() };
});

import { JobFilterSidebar } from './JobFilterSidebar';

// Task 4.1: the sidebar gains a "follow this filter" action. This was a
// behavioral change to an already-shipped component, implemented under the
// Feature Flag Protocol -- RED was captured with a local, OFF-by-default
// flag gating the button's render; GREEN was confirmed with the flag on,
// then the flag was removed once proven (this test now covers the
// unconditional render). See JobFilterFollowButton.test.tsx for the
// button's own click/state behavior coverage.
describe('JobFilterSidebar', () => {
  it('renders the "關注此篩選" follow action (Req 1.1)', () => {
    renderWithProviders(<JobFilterSidebar />);

    expect(
      screen.getByRole('button', { name: /關注此篩選/ }),
    ).toBeInTheDocument();
  });
});
