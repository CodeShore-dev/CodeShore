import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./service', () => ({
  setJobPreference: vi.fn().mockResolvedValue({}),
}));

import { useJobFilterStore } from './jobFilterStore';
import { adjustCounts, usePreferenceMutation } from './mutations';

describe('adjustCounts', () => {
  const counts = { liked_count: 2, disliked_count: 3 };

  it('increments liked from the default list when liking', () => {
    expect(adjustCounts(null, 'like', counts)).toEqual({
      liked_count: 3,
      disliked_count: 3,
    });
  });

  it('increments disliked from the default list when disliking', () => {
    expect(adjustCounts(null, 'dislike', counts)).toEqual({
      liked_count: 2,
      disliked_count: 4,
    });
  });

  it('moves the count when flipping like -> dislike', () => {
    expect(adjustCounts('like', 'dislike', counts)).toEqual({
      liked_count: 1,
      disliked_count: 4,
    });
  });

  it('moves the count when flipping dislike -> like', () => {
    expect(adjustCounts('dislike', 'like', counts)).toEqual({
      liked_count: 3,
      disliked_count: 2,
    });
  });

  it('leaves counts unchanged for a no-op (same tab/preference)', () => {
    expect(adjustCounts('like', 'like', counts)).toEqual(counts);
  });
});

describe('usePreferenceMutation', () => {
  let client: QueryClient;
  const listKey = [
    'job',
    'list',
    { preference: null, page: 1, where: {}, orders: 'x' },
  ];

  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    useJobFilterStore.setState({ listViewPreference: null });
  });

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  it('optimistically removes the job and adjusts counts (req 3.3)', async () => {
    client.setQueryData(listKey, {
      result: [{ id: 'j1' }, { id: 'j2' }],
      count: 2,
    });
    client.setQueryData(['job', 'preferencedCount'], {
      liked_count: 0,
      disliked_count: 0,
    });

    const { result } = renderHook(() => usePreferenceMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ id: 'j1', preference: 'like' });
    });

    const list = client.getQueryData<{ result: { id: string }[] }>(listKey);
    expect(list?.result.map(j => j.id)).toEqual(['j2']);
    expect(
      client.getQueryData<{ liked_count: number }>([
        'job',
        'preferencedCount',
      ])?.liked_count,
    ).toBe(1);
  });
});
