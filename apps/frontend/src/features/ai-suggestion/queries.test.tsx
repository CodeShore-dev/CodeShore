import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchSuggestions, fetchSuggestion } = vi.hoisted(() => ({
  fetchSuggestions: vi.fn(),
  fetchSuggestion: vi.fn(),
}));

vi.mock('./service', () => ({
  fetchSuggestions,
  fetchSuggestion,
}));

import { useSuggestionQuery, useSuggestionsQuery } from './queries';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useSuggestionsQuery', () => {
  it('passes the targetTable/status filter through to fetchSuggestions', async () => {
    fetchSuggestions.mockResolvedValue({ result: [], count: 0 });

    const { result } = renderHook(
      () => useSuggestionsQuery({ targetTable: 'tech', status: 'pending' }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchSuggestions).toHaveBeenCalledWith({
      targetTable: 'tech',
      status: 'pending',
    });
  });

  it('calls fetchSuggestions with an empty filter when none is given', async () => {
    fetchSuggestions.mockResolvedValue({ result: [], count: 0 });

    const { result } = renderHook(() => useSuggestionsQuery(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchSuggestions).toHaveBeenCalledWith({});
  });

  it('refetches under a different queryKey when the filter changes', async () => {
    fetchSuggestions.mockResolvedValue({ result: [], count: 0 });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    function localWrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
    }

    const { result, rerender } = renderHook(
      ({ status }: { status: 'pending' | 'approved' }) =>
        useSuggestionsQuery({ status }),
      { wrapper: localWrapper, initialProps: { status: 'pending' } },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender({ status: 'approved' });

    await waitFor(() =>
      expect(fetchSuggestions).toHaveBeenCalledWith({ status: 'approved' }),
    );
  });
});

describe('useSuggestionQuery', () => {
  it('fetches a single suggestion by id when enabled', async () => {
    fetchSuggestion.mockResolvedValue({ id: 's1' });

    const { result } = renderHook(() => useSuggestionQuery('s1'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchSuggestion).toHaveBeenCalledWith('s1');
  });

  it('does not fetch when no id is given', () => {
    renderHook(() => useSuggestionQuery(undefined), { wrapper });
    expect(fetchSuggestion).not.toHaveBeenCalled();
  });
});
