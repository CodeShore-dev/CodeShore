import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { setJobPreference, clearJobPreferences, deletePreferenceReason } =
  vi.hoisted(() => ({
    setJobPreference: vi.fn(),
    clearJobPreferences: vi.fn(),
    deletePreferenceReason: vi.fn(),
  }));

vi.mock('./service', () => ({
  setJobPreference,
  clearJobPreferences,
  deletePreferenceReason,
}));

import { useJobFilterStore } from './jobFilterStore';
import {
  adjustCounts,
  useClearPreferencesMutation,
  useDeletePreferenceReasonMutation,
  usePreferenceMutation,
} from './mutations';

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
    setJobPreference.mockReset();
    setJobPreference.mockResolvedValue({});
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
      await result.current.mutateAsync({ id: 'j1', preference: 'like', reason: '未分類' });
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

  it('rolls back the optimistic change when the request fails (req 3.3)', async () => {
    setJobPreference.mockRejectedValue(new Error('boom'));
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
      await result.current
        .mutateAsync({ id: 'j1', preference: 'like', reason: '未分類' })
        .catch(() => undefined);
    });

    const list = client.getQueryData<{ result: { id: string }[] }>(listKey);
    expect(list?.result.map(j => j.id)).toEqual(['j1', 'j2']);
    expect(
      client.getQueryData<{ liked_count: number }>([
        'job',
        'preferencedCount',
      ])?.liked_count,
    ).toBe(0);
  });
});

describe('preference reason wiring (req 2.4, 2.8, 5.3, 7.8)', () => {
  let client: QueryClient;
  const listKey = [
    'job',
    'list',
    { preference: null, page: 1, where: {}, orders: 'x' },
  ];

  beforeEach(() => {
    setJobPreference.mockReset();
    setJobPreference.mockResolvedValue({});
    clearJobPreferences.mockReset();
    clearJobPreferences.mockResolvedValue({});
    deletePreferenceReason.mockReset();
    deletePreferenceReason.mockResolvedValue({ updated: 2 });
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

  it('sends the chosen reason to setJobPreference (req 2.4)', async () => {
    const { result } = renderHook(() => usePreferenceMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'j1',
        preference: 'dislike',
        reason: '薪資太低',
      });
    });

    expect(setJobPreference).toHaveBeenCalledWith('j1', 'dislike', '薪資太低');
  });

  it('rolls back lists and counts when tagging with a reason fails (req 2.8)', async () => {
    setJobPreference.mockRejectedValue(new Error('boom'));
    client.setQueryData(listKey, {
      result: [{ id: 'j1' }, { id: 'j2' }],
      count: 2,
    });
    client.setQueryData(['job', 'preferencedCount'], {
      liked_count: 1,
      disliked_count: 4,
    });

    const { result } = renderHook(() => usePreferenceMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current
        .mutateAsync({ id: 'j1', preference: 'dislike', reason: '薪資太低' })
        .catch(() => undefined);
    });

    expect(
      client
        .getQueryData<{ result: { id: string }[] }>(listKey)
        ?.result.map(j => j.id),
    ).toEqual(['j1', 'j2']);
    expect(client.getQueryData(['job', 'preferencedCount'])).toEqual({
      liked_count: 1,
      disliked_count: 4,
    });
  });

  it('invalidates reason counts after tagging settles (req 7.8)', async () => {
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => usePreferenceMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'j1',
        preference: 'like',
        reason: '未分類',
      });
    });

    expect(spy).toHaveBeenCalledWith({
      queryKey: ['job', 'preferenceReasons'],
    });
  });

  it('invalidates reason counts after clearing a bucket (req 7.8)', async () => {
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useClearPreferencesMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync('like');
    });

    expect(spy).toHaveBeenCalledWith({
      queryKey: ['job', 'preferenceReasons'],
    });
  });

  it('deletes a reason and invalidates the list and reason counts (req 5.3, 7.8)', async () => {
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(
      () => useDeletePreferenceReasonMutation(),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({
        preference: 'dislike',
        reason: '通勤太遠',
      });
    });

    expect(deletePreferenceReason).toHaveBeenCalledWith('dislike', '通勤太遠');
    expect(spy).toHaveBeenCalledWith({ queryKey: ['job', 'list'] });
    expect(spy).toHaveBeenCalledWith({
      queryKey: ['job', 'preferenceReasons'],
    });
  });
});
