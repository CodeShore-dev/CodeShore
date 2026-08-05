import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('../../keyword/service', () => ({
  fetchMvTech: vi.fn().mockResolvedValue({ result: [] }),
  fetchTechCategories: vi.fn().mockResolvedValue({ result: [] }),
  updateTech: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../service', () => ({
  fetchLocationGroups: vi.fn().mockResolvedValue({
    result: [
      { location: '台北市信義區', count: 10 },
      { location: '台北市大安區', count: 5 },
      { location: '台北市南港區', count: 3 },
    ],
  }),
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

describe('JobActiveFilters - county-grouped location chips', () => {
  beforeEach(() => {
    useJobFilterStore.getState().reset();
  });

  it('folds 2+ selected districts under one county into a single "全區" chip', async () => {
    useJobFilterStore
      .getState()
      .setSelectedLocations(['台北市信義區', '台北市大安區', '台北市南港區']);

    renderWithProviders(<JobActiveFilters onClearAll={vi.fn()} />);

    await screen.findByText('台北市全區');
    expect(screen.queryByText('台北市信義區')).not.toBeInTheDocument();
  });

  it('shows "部分區" when only some of the county\'s known districts are selected', async () => {
    useJobFilterStore
      .getState()
      .setSelectedLocations(['台北市信義區', '台北市大安區']);

    renderWithProviders(<JobActiveFilters onClearAll={vi.fn()} />);

    await screen.findByText('台北市部分區');
  });

  it('keeps a lone selected district shown by its own name, not folded into a county chip', async () => {
    useJobFilterStore.getState().setSelectedLocations(['台北市信義區']);

    renderWithProviders(<JobActiveFilters onClearAll={vi.fn()} />);

    await screen.findByText('台北市信義區');
    expect(screen.queryByText(/台北市(全區|部分區)/)).not.toBeInTheDocument();
  });

  it('expanding a county chip reveals each district individually, each removable on its own', async () => {
    useJobFilterStore
      .getState()
      .setSelectedLocations(['台北市信義區', '台北市大安區']);

    renderWithProviders(<JobActiveFilters onClearAll={vi.fn()} />);

    await screen.findByText('台北市部分區');
    fireEvent.click(screen.getByTitle('查看各區並取消勾選'));

    const xinyi = await screen.findByText('信義區');
    await screen.findByText('大安區');

    const removeButton = xinyi.parentElement?.querySelector(
      'button[title*="移除"]',
    ) as HTMLElement;
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(useJobFilterStore.getState().selectedLocations).toEqual([
        '台北市大安區',
      ]);
    });
  });

  it('removing a county chip clears every one of its selected districts at once', async () => {
    useJobFilterStore
      .getState()
      .setSelectedLocations(['台北市信義區', '台北市大安區', '新北市板橋區']);

    renderWithProviders(<JobActiveFilters onClearAll={vi.fn()} />);

    await screen.findByText('台北市部分區');
    fireEvent.click(screen.getByTitle('移除 地區：台北市部分區'));

    await waitFor(() => {
      expect(useJobFilterStore.getState().selectedLocations).toEqual([
        '新北市板橋區',
      ]);
    });
  });

  it('keeps the badge item count stable across expand/collapse of a county chip', async () => {
    useJobFilterStore
      .getState()
      .setSelectedLocations(['台北市信義區', '台北市大安區']);

    renderWithProviders(<JobActiveFilters onClearAll={vi.fn()} />);

    await screen.findByText(/目前篩選條件・1 項/);

    await screen.findByText('台北市部分區');
    fireEvent.click(screen.getByTitle('查看各區並取消勾選'));

    await screen.findByText('信義區');
    expect(screen.getByText(/目前篩選條件・1 項/)).toBeInTheDocument();
  });
});
