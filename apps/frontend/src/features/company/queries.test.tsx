import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchCompanies, deriveCompanyWhere } = vi.hoisted(() => ({
  fetchCompanies: vi.fn(),
  deriveCompanyWhere: vi.fn(),
}));

vi.mock('./service', () => ({ fetchCompanies }));
vi.mock('./deriveCompanyWhere', () => ({ deriveCompanyWhere }));

import { useCompanyFilterStore } from './companyFilterStore';
import { useCompanyTechFilterStore } from './companyTechFilterStore';
import { useCompaniesQuery } from './queries';

describe('useCompaniesQuery', () => {
  let client: QueryClient;

  beforeEach(() => {
    fetchCompanies.mockReset();
    fetchCompanies.mockResolvedValue({ result: [{ id: 'c1' }], count: 1 });
    deriveCompanyWhere.mockReset();
    deriveCompanyWhere.mockReturnValue({});
    client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    useCompanyFilterStore.setState({ companyFilters: [], page: 1 });
    useCompanyTechFilterStore.getState().reset();
  });

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  it('derives the where clause from companyFilterStore + companyTechFilterStore state (req 1.5, 1.6, 2.6, 2.7)', async () => {
    useCompanyFilterStore.setState({
      companyFilters: [
        { name: 'Acme', mode: 'include' },
        { name: 'Globex', mode: 'exclude' },
      ],
      page: 1,
    });
    useCompanyTechFilterStore.setState({
      selectedTags: ['go'],
      excludedTags: ['php'],
      keywordOperator: 'or',
    });
    deriveCompanyWhere.mockReturnValue({
      company_name: { in: '(Acme)', 'not.in': '(Globex)' },
      techs: { ov: '{go}', 'not.ov': '{php}' },
    });

    const { result } = renderHook(() => useCompaniesQuery(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(deriveCompanyWhere).toHaveBeenCalledWith({
      companyFilters: [
        { name: 'Acme', mode: 'include' },
        { name: 'Globex', mode: 'exclude' },
      ],
      selectedTags: ['go'],
      excludedTags: ['php'],
      techOperator: 'or',
    });

    expect(fetchCompanies).toHaveBeenCalledWith({
      from: 0,
      to: 17,
      where: JSON.stringify({
        company_name: { in: '(Acme)', 'not.in': '(Globex)' },
        techs: { ov: '{go}', 'not.ov': '{php}' },
      }),
    });

    expect(result.current.companies).toEqual([{ id: 'c1' }]);
    expect(result.current.totalCount).toBe(1);
  });

  it('narrows results consistently when include company, exclude company, and excluded tech are all set together (observable criterion)', async () => {
    useCompanyFilterStore.setState({
      companyFilters: [
        { name: 'Acme', mode: 'include' },
        { name: 'Globex', mode: 'exclude' },
      ],
      page: 1,
    });
    useCompanyTechFilterStore.setState({
      selectedTags: [],
      excludedTags: ['php'],
      keywordOperator: 'and',
    });
    const combinedWhere = {
      company_name: { in: '(Acme)', 'not.in': '(Globex)' },
      techs: { 'not.ov': '{php}' },
    };
    deriveCompanyWhere.mockReturnValue(combinedWhere);

    const { result } = renderHook(() => useCompaniesQuery(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchCompanies).toHaveBeenCalledWith(
      expect.objectContaining({ where: JSON.stringify(combinedWhere) }),
    );
  });

  it('sends undefined where when deriveCompanyWhere returns an empty object', async () => {
    deriveCompanyWhere.mockReturnValue({});

    const { result } = renderHook(() => useCompaniesQuery(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchCompanies).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined }),
    );
  });

  it('paginates using the store page and PAGE_SIZE of 18', async () => {
    useCompanyFilterStore.setState({ companyFilters: [], page: 3 });
    deriveCompanyWhere.mockReturnValue({});

    const { result } = renderHook(() => useCompaniesQuery(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchCompanies).toHaveBeenCalledWith(
      expect.objectContaining({ from: 36, to: 53 }),
    );
  });
});
