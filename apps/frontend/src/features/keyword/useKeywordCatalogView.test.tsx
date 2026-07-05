import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchMvTech, fetchTechCategories } from './service';

vi.mock('./service', () => ({
  fetchMvTech: vi.fn(),
  fetchTechCategories: vi.fn(),
}));

import { createTechFilterStore } from './keywordFilterStore';
import { useKeywordCatalogView } from './useKeywordCatalogView';

const mockedFetchMvTech = vi.mocked(fetchMvTech);
const mockedFetchTechCategories = vi.mocked(fetchTechCategories);

describe('useKeywordCatalogView (parameterized store, task 1.2)', () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    mockedFetchMvTech.mockResolvedValue({
      result: [
        { tech: 'react', label: 'React', category: 'framework', parents: null },
        { tech: 'vue', label: 'Vue', category: 'framework', parents: null },
        { tech: 'js', label: 'JavaScript', category: 'language', parents: null },
      ],
      count: 3,
    } as never);

    mockedFetchTechCategories.mockResolvedValue({
      result: [
        { category: 'framework', count: 2 },
        { category: 'language', count: 1 },
      ],
      count: 2,
    } as never);
  });

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  it('produces independent derived views (selectedTab/keywordSearch) for two different store instances', async () => {
    const storeA = createTechFilterStore();
    const storeB = createTechFilterStore();

    const { result: resultA } = renderHook(
      () => useKeywordCatalogView(storeA),
      { wrapper },
    );
    const { result: resultB } = renderHook(
      () => useKeywordCatalogView(storeB),
      { wrapper },
    );

    // Wait for the shared catalog queries to resolve so tabs are populated.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      resultA.current.setKeywordSearch('react');
    });
    act(() => {
      resultB.current.setSelectedTab('language');
    });

    expect(resultA.current.keywordSearch).toBe('react');
    expect(resultB.current.keywordSearch).toBe('');

    expect(resultB.current.selectedTab).toBe('language');
    expect(resultA.current.selectedTab).not.toBe('language');

    // Both views are still derived from the same underlying catalog data.
    expect(resultA.current.techs).toEqual(resultB.current.techs);
    expect(resultA.current.techs.length).toBe(3);
  });

  it('exposes selection state/actions from the passed-in store so callers do not touch it directly', async () => {
    const store = createTechFilterStore();
    const { result } = renderHook(() => useKeywordCatalogView(store), {
      wrapper,
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.selectedTags).toEqual([]);
    expect(result.current.excludedTags).toEqual([]);
    expect(result.current.keywordOperator).toBe('and');

    act(() => {
      result.current.toggleTech('react');
    });
    expect(result.current.selectedTags).toEqual(['react']);
    expect(store.getState().selectedTags).toEqual(['react']);

    act(() => {
      result.current.setOperator('or');
    });
    expect(result.current.keywordOperator).toBe('or');
    expect(store.getState().keywordOperator).toBe('or');
  });

  it('two instances toggling different techs do not leak selection state into each other', async () => {
    const storeA = createTechFilterStore();
    const storeB = createTechFilterStore();

    const { result: resultA } = renderHook(
      () => useKeywordCatalogView(storeA),
      { wrapper },
    );
    const { result: resultB } = renderHook(
      () => useKeywordCatalogView(storeB),
      { wrapper },
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      resultA.current.toggleTech('react');
    });

    expect(resultA.current.selectedTags).toEqual(['react']);
    expect(resultB.current.selectedTags).toEqual([]);
  });
});
