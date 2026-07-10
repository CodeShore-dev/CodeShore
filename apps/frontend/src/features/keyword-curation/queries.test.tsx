import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchQueue } = vi.hoisted(() => ({
  fetchQueue: vi.fn(),
}));

vi.mock('./service', () => ({
  fetchQueue,
}));

import { useKeywordQueueQuery } from './queries';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useKeywordQueueQuery', () => {
  it('fetches and caches the keyword list from GET /queue', async () => {
    const keywords = [{ id: 'react', count: 42, affectedJobCount: 10 }];
    fetchQueue.mockResolvedValue({ keywords });

    const { result } = renderHook(() => useKeywordQueueQuery(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchQueue).toHaveBeenCalledWith();
    expect(result.current.data).toEqual({ keywords });
  });

  it('exposes a loading state before the fetch resolves', () => {
    fetchQueue.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useKeywordQueueQuery(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('queries under a stable ["keyword-curation", "queue"] queryKey', async () => {
    fetchQueue.mockResolvedValue({ keywords: [] });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useKeywordQueueQuery(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(
      client.getQueryData(['keyword-curation', 'queue']),
    ).toEqual({ keywords: [] });
  });
});
