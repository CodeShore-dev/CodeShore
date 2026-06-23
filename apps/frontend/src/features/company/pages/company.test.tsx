import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';

const { company } = vi.hoisted(() => ({
  company: {
    company_id: 'c1',
    company_name: 'Acme Corp',
    company_type: '',
    job_count: 5,
    techs: [],
    company_link: '',
  },
}));

vi.mock('../service', () => ({
  fetchCompanies: vi
    .fn()
    .mockResolvedValue({ result: [company], count: 1 }),
}));
vi.mock('../../keyword/service', () => ({
  fetchMvTech: vi.fn().mockResolvedValue({ result: [] }),
  fetchTechCategories: vi.fn().mockResolvedValue({ result: [] }),
}));

import { useCompanyFilterStore } from '../companyFilterStore';
import { buildCompanyWhere } from '../queries';
import { CompanyListPage } from './CompanyListPage';

describe('buildCompanyWhere', () => {
  it('returns undefined with no filters', () => {
    expect(buildCompanyWhere('', [], 'and')).toBeUndefined();
  });

  it('encodes a company_name ilike search', () => {
    expect(buildCompanyWhere('acme', [], 'and')).toBe(
      JSON.stringify({ company_name: { ilike: '%acme%' } }),
    );
  });

  it('uses cs for AND and ov for OR on keyword groups (req 6.2)', () => {
    expect(buildCompanyWhere('', ['a', 'b'], 'and')).toBe(
      JSON.stringify({ techs: { cs: '{a,b}' } }),
    );
    expect(buildCompanyWhere('', ['a', 'b'], 'or')).toBe(
      JSON.stringify({ techs: { ov: '{a,b}' } }),
    );
  });
});

describe('useCompanyFilterStore', () => {
  beforeEach(() => {
    useCompanyFilterStore.setState({
      search: '',
      selectedTechs: [],
      techOperator: 'and',
      page: 3,
    });
  });

  it('resets to page 1 when a filter changes (req 6.1)', () => {
    useCompanyFilterStore.getState().setSearch('go');
    expect(useCompanyFilterStore.getState().page).toBe(1);
  });
});

describe('CompanyListPage', () => {
  beforeEach(() => {
    useCompanyFilterStore.getState().clearFilters();
  });

  it('renders companies after load (req 6.1, 6.2)', async () => {
    renderWithProviders(<CompanyListPage />);
    expect(
      screen.getByText('● 公司列表 · COMPANIES'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
  });
});
