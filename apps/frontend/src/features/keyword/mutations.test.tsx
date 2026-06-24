import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { deleteTech, deleteKeyword } = vi.hoisted(() => ({
  deleteTech: vi.fn(),
  deleteKeyword: vi.fn(),
}));

vi.mock('./service', () => ({
  deleteTech,
  deleteKeyword,
  createTech: vi.fn(),
  updateTech: vi.fn(),
  updateTechIconSlugs: vi.fn(),
  resetMvTech: vi.fn(),
}));

import { useDeleteKeywordItemMutation } from './mutations';

describe('useDeleteKeywordItemMutation', () => {
  let client: QueryClient;
  const adminKey = ['keyword', 'admin', 'all', '', 1];

  beforeEach(() => {
    vi.clearAllMocks();
    client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  it('optimistically removes the group and decrements the count', async () => {
    deleteTech.mockResolvedValue(undefined);
    client.setQueryData(adminKey, {
      result: [{ tech: 'g1' }, { tech: 'g2' }],
      count: 2,
    });

    const { result } = renderHook(() => useDeleteKeywordItemMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ id: 'g1', isKeyword: false });
    });

    const data = client.getQueryData<{
      result: { tech: string }[];
      count: number;
    }>(adminKey);
    expect(data?.result.map(g => g.tech)).toEqual(['g2']);
    expect(data?.count).toBe(1);
    expect(deleteTech).toHaveBeenCalledWith('g1');
    expect(deleteKeyword).not.toHaveBeenCalled();
  });

  it('rolls back the optimistic removal when the request fails', async () => {
    deleteKeyword.mockRejectedValue(new Error('boom'));
    client.setQueryData(adminKey, {
      result: [{ tech: 'k1' }, { tech: 'k2' }],
      count: 2,
    });

    const { result } = renderHook(() => useDeleteKeywordItemMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current
        .mutateAsync({ id: 'k1', isKeyword: true })
        .catch(() => undefined);
    });

    const data = client.getQueryData<{
      result: { tech: string }[];
      count: number;
    }>(adminKey);
    expect(data?.result.map(g => g.tech)).toEqual(['k1', 'k2']);
    expect(data?.count).toBe(2);
    expect(deleteKeyword).toHaveBeenCalledWith('k1');
  });
});
