import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchQueue } = vi.hoisted(() => ({
  fetchQueue: vi.fn(),
}));

vi.mock('./service', () => ({
  fetchQueue,
  QUEUE_PAGE_SIZE: 10,
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
  it('fetches page 1 (10/page default) and caches the keyword list from GET /queue', async () => {
    const keywords = [{ id: 'react', count: 42, affectedJobCount: 10 }];
    fetchQueue.mockResolvedValue({ keywords, totalCount: 1 });

    const { result } = renderHook(() => useKeywordQueueQuery(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchQueue).toHaveBeenCalledWith(1, 10);
    expect(result.current.data).toEqual({ keywords, totalCount: 1 });
  });

  it('fetches the requested page when given a page argument', async () => {
    fetchQueue.mockResolvedValue({ keywords: [], totalCount: 0 });

    const { result } = renderHook(() => useKeywordQueueQuery(3), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchQueue).toHaveBeenCalledWith(3, 10);
  });

  it('exposes a loading state before the fetch resolves', () => {
    fetchQueue.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useKeywordQueueQuery(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('queries under a ["keyword-curation", "queue", page] queryKey', async () => {
    fetchQueue.mockResolvedValue({ keywords: [], totalCount: 0 });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useKeywordQueueQuery(2), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(
      client.getQueryData(['keyword-curation', 'queue', 2]),
    ).toEqual({ keywords: [], totalCount: 0 });
  });
});
