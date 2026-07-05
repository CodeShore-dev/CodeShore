import { beforeEach, describe, expect, it } from 'vitest';

import { useCompanyFilterStore } from './companyFilterStore';

beforeEach(() => {
  useCompanyFilterStore.getState().clearFilters();
  useCompanyFilterStore.setState({ page: 4 });
});

describe('companyFilterStore', () => {
  it('adds a company as include, toggles to exclude, toggles back, then removes it (req 1.2, 1.3, 1.4, 1.7)', () => {
    useCompanyFilterStore.getState().addCompanyFilter('Acme Corp');
    expect(useCompanyFilterStore.getState().companyFilters).toEqual([
      { name: 'Acme Corp', mode: 'include' },
    ]);
    expect(useCompanyFilterStore.getState().page).toBe(1);

    useCompanyFilterStore.setState({ page: 4 });
    useCompanyFilterStore.getState().toggleCompanyFilterMode('Acme Corp');
    expect(useCompanyFilterStore.getState().companyFilters).toEqual([
      { name: 'Acme Corp', mode: 'exclude' },
    ]);
    expect(useCompanyFilterStore.getState().page).toBe(1);

    useCompanyFilterStore.setState({ page: 4 });
    useCompanyFilterStore.getState().toggleCompanyFilterMode('Acme Corp');
    expect(useCompanyFilterStore.getState().companyFilters).toEqual([
      { name: 'Acme Corp', mode: 'include' },
    ]);
    expect(useCompanyFilterStore.getState().page).toBe(1);

    useCompanyFilterStore.setState({ page: 4 });
    useCompanyFilterStore.getState().removeCompanyFilter('Acme Corp');
    expect(useCompanyFilterStore.getState().companyFilters).toEqual([]);
    expect(useCompanyFilterStore.getState().page).toBe(1);
  });

  it('adding a company that already exists updates it to include instead of duplicating', () => {
    useCompanyFilterStore.getState().addCompanyFilter('Acme Corp');
    useCompanyFilterStore.getState().toggleCompanyFilterMode('Acme Corp');
    expect(useCompanyFilterStore.getState().companyFilters).toEqual([
      { name: 'Acme Corp', mode: 'exclude' },
    ]);

    useCompanyFilterStore.getState().addCompanyFilter('Acme Corp');
    expect(useCompanyFilterStore.getState().companyFilters).toEqual([
      { name: 'Acme Corp', mode: 'include' },
    ]);
  });

  it('clearFilters() resets companyFilters back to an empty list and page to 1', () => {
    useCompanyFilterStore.getState().addCompanyFilter('Acme Corp');
    useCompanyFilterStore.setState({ page: 4 });

    useCompanyFilterStore.getState().clearFilters();
    expect(useCompanyFilterStore.getState().companyFilters).toEqual([]);
    expect(useCompanyFilterStore.getState().page).toBe(1);
  });

  it('does not retain the old technology-selection or free-text search fields (req 2.1)', () => {
    const state = useCompanyFilterStore.getState();
    expect(state).not.toHaveProperty('search');
    expect(state).not.toHaveProperty('setSearch');
    expect(state).not.toHaveProperty('selectedTechs');
    expect(state).not.toHaveProperty('toggleTech');
    expect(state).not.toHaveProperty('techOperator');
    expect(state).not.toHaveProperty('setOperator');
  });
});
