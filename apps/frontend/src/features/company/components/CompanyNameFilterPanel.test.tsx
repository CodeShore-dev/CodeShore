import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { useCompanyFilterStore } from '../companyFilterStore';

vi.mock('../service', () => ({
  fetchCompanies: vi.fn().mockResolvedValue({
    result: [
      { company_id: '1', company_name: 'Acme Corp' },
      { company_id: '2', company_name: 'Beta Inc' },
    ],
  }),
}));

import { CompanyNameFilterPanel } from './CompanyNameFilterPanel';

describe('CompanyNameFilterPanel', () => {
  beforeEach(() => {
    useCompanyFilterStore.getState().clearFilters();
  });

  it('shows matching companies not already selected when typing a query (Req 1.1, 1.8)', async () => {
    renderWithProviders(<CompanyNameFilterPanel />);

    const input = screen.getByPlaceholderText(/搜尋/);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'a' } });

    await screen.findByText('Acme Corp');
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
  });

  it('excludes companies already present in companyFilters from suggestions, regardless of mode (Req 1.8)', async () => {
    useCompanyFilterStore.getState().addCompanyFilter('Acme Corp');
    useCompanyFilterStore.getState().toggleCompanyFilterMode('Acme Corp');

    renderWithProviders(<CompanyNameFilterPanel />);

    const input = screen.getByPlaceholderText(/搜尋/);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'a' } });

    await screen.findByText('Beta Inc');

    // "Acme Corp" is already selected (as exclude) -- should not appear in
    // the suggestions dropdown, only as its chip.
    const suggestionList = screen.getAllByText('Acme Corp');
    expect(suggestionList).toHaveLength(1);
  });

  it('selecting a suggestion adds an include chip and clears the search text (Req 1.2)', async () => {
    renderWithProviders(<CompanyNameFilterPanel />);

    const input = screen.getByPlaceholderText(/搜尋/) as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'acme' } });

    const suggestion = await screen.findByText('Acme Corp');
    fireEvent.mouseDown(suggestion);

    await waitFor(() => {
      expect(useCompanyFilterStore.getState().companyFilters).toEqual([
        { name: 'Acme Corp', mode: 'include' },
      ]);
    });

    expect(input.value).toBe('');

    const chip = screen.getByText('Acme Corp').parentElement;
    expect(chip?.className).toContain('bg-[#003d92]');
  });

  it('clicking the toggle control switches the chip to exclude (Req 1.3, 1.4)', async () => {
    useCompanyFilterStore.getState().addCompanyFilter('Acme Corp');

    renderWithProviders(<CompanyNameFilterPanel />);

    const toggleButton = screen.getByTitle(/切換為排除/);
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(useCompanyFilterStore.getState().companyFilters).toEqual([
        { name: 'Acme Corp', mode: 'exclude' },
      ]);
    });

    const chip = screen.getByText('Acme Corp').parentElement;
    expect(chip?.className).toContain('bg-[#ba1a1a]');
  });

  it('clicking remove drops the chip and removes it from the store (Req 1.7)', async () => {
    useCompanyFilterStore.getState().addCompanyFilter('Acme Corp');

    renderWithProviders(<CompanyNameFilterPanel />);

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();

    const removeButton = screen.getByTitle(/移除/);
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(useCompanyFilterStore.getState().companyFilters).toEqual([]);
    });
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
  });
});
