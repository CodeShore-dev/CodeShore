import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Capture the fake EventSource the hook creates (via a hoisted ref so the
// vi.mock factory can reference it).
const h = vi.hoisted(() => ({
  ref: { current: null as null | { onmessage: ((e: { data: string }) => void) | null; onerror: (() => void) | null; close: () => void } },
}));

vi.mock('../service', () => ({
  createCrawlEventSource: () => {
    h.ref.current = { onmessage: null, onerror: null, close: vi.fn() };
    return h.ref.current;
  },
}));

import { useCrawlStream } from './useCrawlStream';

function emit(payload: unknown) {
  h.ref.current?.onmessage?.({ data: JSON.stringify(payload) });
}

describe('useCrawlStream', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
    h.ref.current = null;
  });

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  it('collects log messages and finishes, refreshing on success (req 3.3)', () => {
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCrawlStream(), { wrapper });

    act(() => result.current.start('job-1'));
    expect(result.current.crawlJobId).toBe('job-1');

    act(() => emit({ data: { type: 'log', message: '開始爬取' } }));
    expect(result.current.progress).toEqual(['開始爬取']);

    act(() => emit({ data: { type: 'done', success: true } }));
    expect(result.current.done).toBe(true);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['job', 'list'] });
  });
});
