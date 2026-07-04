import { beforeEach, describe, expect, it } from 'vitest';

import { useJobFilterStore } from './jobFilterStore';

beforeEach(() => {
  useJobFilterStore.getState().reset();
  useJobFilterStore.setState({ page: 4 });
});

describe('jobFilterStore', () => {
  it('resets to page 1 when a filter changes (req 3.2)', () => {
    useJobFilterStore.getState().setSearchText('react');
    expect(useJobFilterStore.getState().page).toBe(1);
  });

  it('does not reset page when only selectedJobId changes', () => {
    useJobFilterStore.getState().setSelectedJobId('job-1');
    expect(useJobFilterStore.getState().page).toBe(4);
  });

  it('adds a company as include, toggles to exclude, toggles back, then removes it (req 4.2, 4.3, 4.4, 4.7)', () => {
    useJobFilterStore.getState().addCompanyFilter('Acme Corp');
    expect(useJobFilterStore.getState().companyFilters).toEqual([
      { name: 'Acme Corp', mode: 'include' },
    ]);
    expect(useJobFilterStore.getState().page).toBe(1);

    useJobFilterStore.setState({ page: 4 });
    useJobFilterStore.getState().toggleCompanyFilterMode('Acme Corp');
    expect(useJobFilterStore.getState().companyFilters).toEqual([
      { name: 'Acme Corp', mode: 'exclude' },
    ]);
    expect(useJobFilterStore.getState().page).toBe(1);

    useJobFilterStore.setState({ page: 4 });
    useJobFilterStore.getState().toggleCompanyFilterMode('Acme Corp');
    expect(useJobFilterStore.getState().companyFilters).toEqual([
      { name: 'Acme Corp', mode: 'include' },
    ]);
    expect(useJobFilterStore.getState().page).toBe(1);

    useJobFilterStore.setState({ page: 4 });
    useJobFilterStore.getState().removeCompanyFilter('Acme Corp');
    expect(useJobFilterStore.getState().companyFilters).toEqual([]);
    expect(useJobFilterStore.getState().page).toBe(1);
  });

  it('adding a company that already exists updates it to include instead of duplicating', () => {
    useJobFilterStore.getState().addCompanyFilter('Acme Corp');
    useJobFilterStore.getState().toggleCompanyFilterMode('Acme Corp');
    expect(useJobFilterStore.getState().companyFilters).toEqual([
      { name: 'Acme Corp', mode: 'exclude' },
    ]);

    useJobFilterStore.getState().addCompanyFilter('Acme Corp');
    expect(useJobFilterStore.getState().companyFilters).toEqual([
      { name: 'Acme Corp', mode: 'include' },
    ]);
  });

  it('reset() clears companyFilters back to an empty list', () => {
    useJobFilterStore.getState().addCompanyFilter('Acme Corp');
    useJobFilterStore.getState().reset();
    expect(useJobFilterStore.getState().companyFilters).toEqual([]);
  });
});
