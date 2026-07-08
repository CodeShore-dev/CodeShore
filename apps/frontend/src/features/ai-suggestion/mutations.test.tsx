import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { approveSuggestion, rejectSuggestion } = vi.hoisted(() => ({
  approveSuggestion: vi.fn(),
  rejectSuggestion: vi.fn(),
}));

vi.mock('./service', () => ({
  approveSuggestion,
  rejectSuggestion,
}));

import {
  useApproveSuggestionMutation,
  useRejectSuggestionMutation,
} from './mutations';

describe('useApproveSuggestionMutation / useRejectSuggestionMutation', () => {
  let client: QueryClient;

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

  it('approves without an editedPayload when none is given', async () => {
    approveSuggestion.mockResolvedValue({ id: 's1', status: 'approved' });

    const { result } = renderHook(() => useApproveSuggestionMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ id: 's1' });
    });

    expect(approveSuggestion).toHaveBeenCalledWith('s1', undefined);
  });

  it('approves with the reviewer-edited payload when given (requirement 7.4)', async () => {
    approveSuggestion.mockResolvedValue({ id: 's1', status: 'approved' });

    const { result } = renderHook(() => useApproveSuggestionMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: 's1',
        editedPayload: { name: 'react' },
      });
    });

    expect(approveSuggestion).toHaveBeenCalledWith('s1', { name: 'react' });
  });

  it('invalidates the suggestions list on approve success, removing the row from a pending-filtered list', async () => {
    approveSuggestion.mockResolvedValue({ id: 's1', status: 'approved' });
    const listKey = ['ai-suggestion', 'list', null, 'pending'];
    client.setQueryData(listKey, {
      result: [{ id: 's1' }, { id: 's2' }],
      count: 2,
    });

    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useApproveSuggestionMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ id: 's1' });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['ai-suggestion', 'list'],
    });
  });

  it('rejects with an optional note', async () => {
    rejectSuggestion.mockResolvedValue({ id: 's1', status: 'rejected' });

    const { result } = renderHook(() => useRejectSuggestionMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ id: 's1', note: '重複建議' });
    });

    expect(rejectSuggestion).toHaveBeenCalledWith('s1', '重複建議');
  });

  it('invalidates the suggestions list on reject success', async () => {
    rejectSuggestion.mockResolvedValue({ id: 's1', status: 'rejected' });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useRejectSuggestionMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ id: 's1' });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['ai-suggestion', 'list'],
    });
  });
});
