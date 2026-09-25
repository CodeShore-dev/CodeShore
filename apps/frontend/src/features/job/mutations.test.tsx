import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  setJobPreference,
  clearJobPreferences,
  deletePreferenceReason,
  renamePreferenceReason,
} = vi.hoisted(() => ({
  setJobPreference: vi.fn(),
  clearJobPreferences: vi.fn(),
  deletePreferenceReason: vi.fn(),
  renamePreferenceReason: vi.fn(),
}));

vi.mock('./service', () => ({
  setJobPreference,
  clearJobPreferences,
  deletePreferenceReason,
  renamePreferenceReason,
}));

import { useJobFilterStore } from './jobFilterStore';
import {
  adjustCounts,
  useChangeReasonMutation,
  useClearPreferencesMutation,
  useDeletePreferenceReasonMutation,
  usePreferenceMutation,
  useRenamePreferenceReasonMutation,
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

describe('useChangeReasonMutation (req 8.3, 8.6, 8.7)', () => {
  let client: QueryClient;
  const listKey = [
    'job',
    'list',
    { preference: 'like', page: 1, where: {}, orders: 'x' },
  ];

  beforeEach(() => {
    setJobPreference.mockReset();
    setJobPreference.mockResolvedValue({});
    client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  it('calls setJobPreference with the job id, preference and new reason (req 8.3)', async () => {
    const { result } = renderHook(() => useChangeReasonMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'j1',
        preference: 'like',
        reason: '薪資太低',
      });
    });

    expect(setJobPreference).toHaveBeenCalledWith('j1', 'like', '薪資太低');
  });

  it('keeps the job in the cached list and updates its reason (req 8.3, 8.6)', async () => {
    client.setQueryData(listKey, {
      result: [
        { id: 'j1', preference_reason: '未分類' },
        { id: 'j2', preference_reason: '未分類' },
      ],
      count: 2,
    });

    const { result } = renderHook(() => useChangeReasonMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'j1',
        preference: 'like',
        reason: '薪資太低',
      });
    });

    const list = client.getQueryData<{
      result: { id: string; preference_reason: string }[];
    }>(listKey);
    expect(list?.result).toEqual([
      { id: 'j1', preference_reason: '薪資太低' },
      { id: 'j2', preference_reason: '未分類' },
    ]);
  });

  it('restores the previous reason when the change fails (req 8.7)', async () => {
    setJobPreference.mockRejectedValue(new Error('boom'));
    client.setQueryData(listKey, {
      result: [{ id: 'j1', preference_reason: '未分類' }],
      count: 1,
    });

    const { result } = renderHook(() => useChangeReasonMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current
        .mutateAsync({ id: 'j1', preference: 'like', reason: '薪資太低' })
        .catch(() => undefined);
    });

    const list = client.getQueryData<{
      result: { id: string; preference_reason: string }[];
    }>(listKey);
    expect(list?.result).toEqual([
      { id: 'j1', preference_reason: '未分類' },
    ]);
  });

  it('invalidates the job list and reason counts after settling (req 8.6)', async () => {
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useChangeReasonMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'j1',
        preference: 'like',
        reason: '薪資太低',
      });
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ['job', 'list'] });
    expect(spy).toHaveBeenCalledWith({
      queryKey: ['job', 'preferenceReasons'],
    });
  });
});

describe('useRenamePreferenceReasonMutation (req 9.3, 9.8)', () => {
  let client: QueryClient;

  beforeEach(() => {
    renamePreferenceReason.mockReset();
    renamePreferenceReason.mockResolvedValue({ updated: 3 });
    client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  it('calls renamePreferenceReason with the preference, old reason and new name', async () => {
    const { result } = renderHook(() => useRenamePreferenceReasonMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        preference: 'like',
        reason: '技能已符合',
        name: '技能完全符合',
      });
    });

    expect(renamePreferenceReason).toHaveBeenCalledWith(
      'like',
      '技能已符合',
      '技能完全符合',
    );
  });

  it('writes the new name into the cached reason list and job lists before the caller callback (req 9.7)', async () => {
    client.setQueryData(['job', 'preferenceReasons', 'like'], [
      { reason: '未分類', job_count: 1 },
      { reason: '技能已符合', job_count: 2 },
    ]);
    client.setQueryData(['job', 'list', { page: 1 }], {
      result: [
        { id: 'j1', preference_reason: '技能已符合' },
        { id: 'j2', preference_reason: '未分類' },
      ],
      count: 2,
    });
    const seen: unknown[] = [];
    const { result } = renderHook(() => useRenamePreferenceReasonMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(
        { preference: 'like', reason: '技能已符合', name: '技能完全符合' },
        { onSuccess: () => seen.push(client.getQueryData(['job', 'preferenceReasons', 'like'])) },
      );
    });

    expect(seen[0]).toEqual([
      { reason: '未分類', job_count: 1 },
      { reason: '技能完全符合', job_count: 2 },
    ]);
    const list = client.getQueryData<{ result: { id: string; preference_reason: string }[] }>([
      'job',
      'list',
      { page: 1 },
    ]);
    expect(list?.result.map(j => j.preference_reason)).toEqual(['技能完全符合', '未分類']);
  });

  it('lets a later rename reuse a name an earlier rename released (A→B, then C→A)', async () => {
    client.setQueryData(['job', 'preferenceReasons', 'like'], [
      { reason: 'A', job_count: 2 },
      { reason: 'C', job_count: 1 },
    ]);
    const { result } = renderHook(() => useRenamePreferenceReasonMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ preference: 'like', reason: 'A', name: 'B' });
      await result.current.mutateAsync({ preference: 'like', reason: 'C', name: 'A' });
    });

    expect(client.getQueryData(['job', 'preferenceReasons', 'like'])).toEqual([
      { reason: 'B', job_count: 2 },
      { reason: 'A', job_count: 1 },
    ]);
  });

  it('does not touch the other preference type', async () => {
    client.setQueryData(['job', 'preferenceReasons', 'dislike'], [{ reason: '技能已符合', job_count: 4 }]);
    const { result } = renderHook(() => useRenamePreferenceReasonMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ preference: 'like', reason: '技能已符合', name: '新名稱' });
    });

    expect(client.getQueryData(['job', 'preferenceReasons', 'dislike'])).toEqual([
      { reason: '技能已符合', job_count: 4 },
    ]);
  });

  it('invalidates the job list and reason counts on success (req 9.8)', async () => {
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useRenamePreferenceReasonMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        preference: 'like',
        reason: '技能已符合',
        name: '技能完全符合',
      });
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ['job', 'list'] });
    expect(spy).toHaveBeenCalledWith({
      queryKey: ['job', 'preferenceReasons'],
    });
  });

  it('rejects and does not invalidate when the rename fails', async () => {
    renamePreferenceReason.mockRejectedValue(
      Object.assign(new Error('conflict'), { response: { status: 409 } }),
    );
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useRenamePreferenceReasonMutation(), {
      wrapper,
    });

    await expect(
      result.current.mutateAsync({
        preference: 'like',
        reason: '技能已符合',
        name: '技能完全符合',
      }),
    ).rejects.toThrow('conflict');

    expect(spy).not.toHaveBeenCalled();
  });
});
