import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('../../keyword/service', () => ({
  fetchMvTech: vi.fn().mockResolvedValue({ result: [] }),
  fetchTechCategories: vi.fn().mockResolvedValue({ result: [] }),
  updateTech: vi.fn().mockResolvedValue(undefined),
}));

import { useJobFilterStore } from '../jobFilterStore';
import { JobActiveFilters } from './JobActiveFilters';

describe('JobActiveFilters - company filter chips (Req 4.2, 4.3, 4.7)', () => {
  beforeEach(() => {
    useJobFilterStore.getState().reset();
  });

  it('renders one chip per company filter entry, colored by include/exclude mode', async () => {
    useJobFilterStore.setState({
      companyFilters: [
        { name: 'Acme Corp', mode: 'include' },
        { name: 'Globex', mode: 'exclude' },
      ],
    });

    renderWithProviders(<JobActiveFilters onClearAll={vi.fn()} />);

    const includeChipText = await screen.findByText('Acme Corp');
    const excludeChipText = await screen.findByText('Globex');

    const includeChip = includeChipText.parentElement;
    const excludeChip = excludeChipText.parentElement;

    expect(includeChip?.className).toContain('bg-[#003d92]');
    expect(excludeChip?.className).toContain('bg-[#ba1a1a]');
    expect(includeChip?.className).not.toContain('bg-[#ba1a1a]');
    expect(excludeChip?.className).not.toContain('bg-[#003d92]');
  });

  it('removes only the dismissed company entry from the store when its chip close button is clicked', async () => {
    const user = userEvent.setup();
    useJobFilterStore.setState({
      companyFilters: [
        { name: 'Acme Corp', mode: 'include' },
        { name: 'Globex', mode: 'exclude' },
      ],
    });

    renderWithProviders(<JobActiveFilters onClearAll={vi.fn()} />);

    const includeChipText = await screen.findByText('Acme Corp');
    const includeChip = includeChipText.parentElement as HTMLElement;
    const removeButton = includeChip.querySelector('button') as HTMLElement;

    await user.click(removeButton);

    expect(useJobFilterStore.getState().companyFilters).toEqual([
      { name: 'Globex', mode: 'exclude' },
    ]);
  });
});
