import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { useJobFilterStore } from '../jobFilterStore';

vi.mock('../../company/service', () => ({
  fetchCompanies: vi.fn().mockResolvedValue({
    result: [
      { company_id: '1', company_name: 'Acme Corp' },
      { company_id: '2', company_name: 'Beta Inc' },
    ],
  }),
}));

import { JobCompanyFilterPanel } from './JobCompanyFilterPanel';

describe('JobCompanyFilterPanel', () => {
  beforeEach(() => {
    useJobFilterStore.getState().reset();
  });

  it('shows matching companies not already selected when typing a query (Req 4.1)', async () => {
    renderWithProviders(<JobCompanyFilterPanel />);

    const input = screen.getByPlaceholderText(/搜尋/);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'a' } });

    await screen.findByText('Acme Corp');
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
  });

  it('excludes companies already present in companyFilters from suggestions, regardless of mode', async () => {
    useJobFilterStore.getState().addCompanyFilter('Acme Corp');
    useJobFilterStore.getState().toggleCompanyFilterMode('Acme Corp');

    renderWithProviders(<JobCompanyFilterPanel />);

    const input = screen.getByPlaceholderText(/搜尋/);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'a' } });

    await screen.findByText('Beta Inc');

    // "Acme Corp" is already selected (as exclude) -- should not appear in
    // the suggestions dropdown, only as its chip.
    const suggestionList = screen.getAllByText('Acme Corp');
    // Only the chip rendering should exist, not a second suggestion entry.
    expect(suggestionList).toHaveLength(1);
  });

  it('selecting a suggestion adds an include-styled chip (Req 4.2)', async () => {
    renderWithProviders(<JobCompanyFilterPanel />);

    const input = screen.getByPlaceholderText(/搜尋/);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'acme' } });

    const suggestion = await screen.findByText('Acme Corp');
    fireEvent.mouseDown(suggestion);

    await waitFor(() => {
      expect(useJobFilterStore.getState().companyFilters).toEqual([
        { name: 'Acme Corp', mode: 'include' },
      ]);
    });

    const chip = screen.getByText('Acme Corp').parentElement;
    expect(chip?.className).toContain('bg-[#003d92]');
  });

  it('clicking the toggle control switches the chip to exclude-styled (Req 4.3, 4.4)', async () => {
    useJobFilterStore.getState().addCompanyFilter('Acme Corp');

    renderWithProviders(<JobCompanyFilterPanel />);

    const toggleButton = screen.getByTitle(/切換為排除|排除/);
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(useJobFilterStore.getState().companyFilters).toEqual([
        { name: 'Acme Corp', mode: 'exclude' },
      ]);
    });

    const chip = screen.getByText('Acme Corp').parentElement;
    expect(chip?.className).toContain('bg-[#ba1a1a]');
  });

  it('clicking remove drops the chip and removes it from the store (Req 4.7)', async () => {
    useJobFilterStore.getState().addCompanyFilter('Acme Corp');

    renderWithProviders(<JobCompanyFilterPanel />);

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();

    const removeButton = screen.getByTitle(/移除/);
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(useJobFilterStore.getState().companyFilters).toEqual([]);
    });
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
  });

  it('applies shrink-0 tabular-nums to the count badge (Req 3.1, 3.2)', async () => {
    useJobFilterStore.getState().addCompanyFilter('Acme Corp');
    useJobFilterStore.getState().addCompanyFilter('Beta Inc');

    renderWithProviders(<JobCompanyFilterPanel />);

    const countEl = await screen.findByText('2');
    expect(countEl.className).toContain('shrink-0');
    expect(countEl.className).toContain('tabular-nums');
  });
});
