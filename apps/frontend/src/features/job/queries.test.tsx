import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchPreferenceReasons, fetchJobs } = vi.hoisted(() => ({
  fetchPreferenceReasons: vi.fn(),
  fetchJobs: vi.fn(),
}));

vi.mock('./service', () => ({
  DEFAULT_JOB_ORDERS: 'x',
  fetchPreferenceReasons,
  fetchJobs,
}));

import { useJobsQuery, usePreferenceReasonsQuery } from './queries';

describe('usePreferenceReasonsQuery (req 7.8)', () => {
  let client: QueryClient;

  beforeEach(() => {
    fetchPreferenceReasons.mockReset();
    fetchPreferenceReasons.mockResolvedValue([
      { reason: '未分類', job_count: 3 },
    ]);
    client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  it('fetches reason counts under the per-preference key', async () => {
    const { result } = renderHook(
      () => usePreferenceReasonsQuery('dislike'),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchPreferenceReasons).toHaveBeenCalledWith('dislike');
    expect(
      client.getQueryData(['job', 'preferenceReasons', 'dislike']),
    ).toEqual([{ reason: '未分類', job_count: 3 }]);
  });

  it('does not fetch when disabled', () => {
    renderHook(() => usePreferenceReasonsQuery('like', false), { wrapper });
    expect(fetchPreferenceReasons).not.toHaveBeenCalled();
  });
});

describe('useJobsQuery preferenceReason filter (req 7.2, 7.3, 7.4)', () => {
  let client: QueryClient;

  beforeEach(() => {
    fetchJobs.mockReset();
    fetchJobs.mockResolvedValue({ result: [], total: 0 });
    client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  const baseWhere = { salary_filter: { eq: 'only' } };

  function lastWhere(): Record<string, unknown> {
    const call = fetchJobs.mock.calls.at(-1);
    return JSON.parse((call?.[0] as { where: string }).where);
  }

  it('adds preference_reason.eq merged with existing filters when both preference and reason are set', async () => {
    const { result } = renderHook(
      () =>
        useJobsQuery({
          preference: 'dislike',
          preferenceReason: '差一點要補技能經驗',
          page: 1,
          where: baseWhere,
          orders: 'x',
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(lastWhere()).toEqual({
      preference: { eq: 'dislike' },
      preference_reason: { eq: '差一點要補技能經驗' },
      salary_filter: { eq: 'only' },
    });
  });

  it('omits preference_reason when preferenceReason is null (全部)', async () => {
    const { result } = renderHook(
      () =>
        useJobsQuery({
          preference: 'like',
          preferenceReason: null,
          page: 1,
          where: baseWhere,
          orders: 'x',
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(lastWhere()).not.toHaveProperty('preference_reason');
    expect(lastWhere()).toHaveProperty('salary_filter');
  });

  it('ignores preferenceReason on the 總數 tab (preference null)', async () => {
    const { result } = renderHook(
      () =>
        useJobsQuery({
          preference: null,
          preferenceReason: 'A',
          page: 1,
          where: baseWhere,
          orders: 'x',
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(lastWhere()).toEqual({
      preference: { is: null },
      salary_filter: { eq: 'only' },
    });
  });

  it('uses distinct query keys per preferenceReason', async () => {
    const { result, rerender } = renderHook(
      ({ reason }: { reason: string | null }) =>
        useJobsQuery({
          preference: 'like',
          preferenceReason: reason,
          page: 1,
          where: {},
          orders: 'x',
        }),
      { wrapper, initialProps: { reason: 'A' as string | null } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender({ reason: 'B' });
    await waitFor(() => expect(fetchJobs).toHaveBeenCalledTimes(2));
    const keys = client
      .getQueryCache()
      .getAll()
      .map(q => JSON.stringify(q.queryKey));
    expect(keys.some(k => k.includes('"preferenceReason":"A"'))).toBe(true);
    expect(keys.some(k => k.includes('"preferenceReason":"B"'))).toBe(true);
  });
});
