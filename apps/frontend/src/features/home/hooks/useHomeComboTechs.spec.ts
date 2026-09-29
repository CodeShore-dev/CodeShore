import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ListQuery } from '../../../@types';

const { fetchMvTechRanking } = vi.hoisted(() => ({
  fetchMvTechRanking: vi.fn(),
}));

vi.mock('../service', () => ({ fetchMvTechRanking }));

import { useHomeComboTechs } from './useHomeComboTechs';

interface RankingRow {
  tech: string;
}

// 每個分類回傳 `count` 筆假資料，tech 命名為 `{category}-{n}`。
function rowsFor(category: string, count: number): RankingRow[] {
  return Array.from({ length: count }, (_, i) => ({
    tech: `${category}-${i + 1}`,
  }));
}

function categoryOf(query: ListQuery): string {
  const where = JSON.parse(String(query.where)) as {
    category?: { eq?: string };
  };
  return where.category?.eq ?? '';
}

function mockRanking(countByCategory: Record<string, number>) {
  fetchMvTechRanking.mockImplementation(async (query: ListQuery) => {
    const category = categoryOf(query);
    return { result: rowsFor(category, countByCategory[category] ?? 0) };
  });
}

describe('useHomeComboTechs', () => {
  beforeEach(() => {
    fetchMvTechRanking.mockReset();
  });

  it('四個分類各取 5 個技術，順序依 CATEGORY_PRIORITY', async () => {
    mockRanking({ language: 8, framework: 8, database: 8, library: 8 });

    const { result } = renderHook(() => useHomeComboTechs());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items).toHaveLength(20);
    expect(result.current.items.map(item => item.category)).toEqual([
      ...Array(5).fill('language'),
      ...Array(5).fill('framework'),
      ...Array(5).fill('database'),
      ...Array(5).fill('library'),
    ]);
    expect(result.current.items[0].tech).toBe('language-1');
    expect(result.current.items[19].tech).toBe('library-5');
  });

  it('某類技術不足 5 個時，有幾個就幾個，不補其他類', async () => {
    mockRanking({ language: 5, framework: 2, database: 1, library: 0 });

    const { result } = renderHook(() => useHomeComboTechs());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items.map(item => item.tech)).toEqual([
      'language-1',
      'language-2',
      'language-3',
      'language-4',
      'language-5',
      'framework-1',
      'framework-2',
      'database-1',
    ]);
  });

  it('每個分類各發一次請求，帶 job_count >= 8 門檻與 top 5 範圍', async () => {
    mockRanking({ language: 5, framework: 5, database: 5, library: 5 });

    const { result } = renderHook(() => useHomeComboTechs());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchMvTechRanking).toHaveBeenCalledTimes(4);
    const queries = fetchMvTechRanking.mock.calls.map(
      ([query]: [ListQuery]) => query,
    );
    expect(queries.map(categoryOf)).toEqual([
      'language',
      'framework',
      'database',
      'library',
    ]);
    for (const query of queries) {
      expect(query.from).toBe(0);
      expect(query.to).toBe(4);
      expect(query.orders).toBe('job_count:desc');
      expect(JSON.parse(String(query.where)).job_count).toEqual({ gte: 8 });
    }
  });

  it('請求失敗時回空清單並結束載入', async () => {
    fetchMvTechRanking.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useHomeComboTechs());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items).toEqual([]);
  });
});
