import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { deleteKeywordGroup, deleteKeyword } = vi.hoisted(() => ({
  deleteKeywordGroup: vi.fn(),
  deleteKeyword: vi.fn(),
}));

vi.mock('./service', () => ({
  deleteKeywordGroup,
  deleteKeyword,
  createKeywordGroup: vi.fn(),
  updateKeywordGroup: vi.fn(),
  updateKeywordGroupIconSlugs: vi.fn(),
  resetMvKeywordGroup: vi.fn(),
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
    deleteKeywordGroup.mockResolvedValue(undefined);
    client.setQueryData(adminKey, {
      result: [{ keyword_group: 'g1' }, { keyword_group: 'g2' }],
      count: 2,
    });

    const { result } = renderHook(() => useDeleteKeywordItemMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ id: 'g1', isKeyword: false });
    });

    const data = client.getQueryData<{
      result: { keyword_group: string }[];
      count: number;
    }>(adminKey);
    expect(data?.result.map(g => g.keyword_group)).toEqual(['g2']);
    expect(data?.count).toBe(1);
    expect(deleteKeywordGroup).toHaveBeenCalledWith('g1');
    expect(deleteKeyword).not.toHaveBeenCalled();
  });

  it('rolls back the optimistic removal when the request fails', async () => {
    deleteKeyword.mockRejectedValue(new Error('boom'));
    client.setQueryData(adminKey, {
      result: [{ keyword_group: 'k1' }, { keyword_group: 'k2' }],
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
      result: { keyword_group: string }[];
      count: number;
    }>(adminKey);
    expect(data?.result.map(g => g.keyword_group)).toEqual(['k1', 'k2']);
    expect(data?.count).toBe(2);
    expect(deleteKeyword).toHaveBeenCalledWith('k1');
  });
});
