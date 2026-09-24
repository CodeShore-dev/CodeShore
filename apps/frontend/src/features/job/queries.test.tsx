import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchPreferenceReasons } = vi.hoisted(() => ({
  fetchPreferenceReasons: vi.fn(),
}));

vi.mock('./service', () => ({
  DEFAULT_JOB_ORDERS: 'x',
  fetchPreferenceReasons,
}));

import { usePreferenceReasonsQuery } from './queries';

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
