import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchSuggestions, fetchSuggestion, fetchLlmSettings, fetchWorkflowInfo } = vi.hoisted(() => ({
  fetchSuggestions: vi.fn(),
  fetchSuggestion: vi.fn(),
  fetchLlmSettings: vi.fn(),
  fetchWorkflowInfo: vi.fn(),
}));

vi.mock('./service', () => ({
  fetchSuggestions,
  fetchSuggestion,
  fetchLlmSettings,
  fetchWorkflowInfo,
}));

import {
  useLlmSettingsQuery,
  useSuggestionQuery,
  useSuggestionsQuery,
  useWorkflowInfoQuery,
} from './queries';

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

  it('passes the createdAfter/createdBefore filter through to fetchSuggestions (requirement 10.2)', async () => {
    fetchSuggestions.mockResolvedValue({ result: [], count: 0 });

    const { result } = renderHook(
      () =>
        useSuggestionsQuery({
          createdAfter: '2026-01-01',
          createdBefore: '2026-06-30',
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchSuggestions).toHaveBeenCalledWith({
      createdAfter: '2026-01-01',
      createdBefore: '2026-06-30',
    });
  });

  it('refetches under a different queryKey when the createdAfter/createdBefore range changes (requirement 10.2)', async () => {
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
      ({ createdAfter }: { createdAfter: string }) =>
        useSuggestionsQuery({ createdAfter }),
      { wrapper: localWrapper, initialProps: { createdAfter: '2026-01-01' } },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender({ createdAfter: '2026-02-01' });

    await waitFor(() =>
      expect(fetchSuggestions).toHaveBeenCalledWith({
        createdAfter: '2026-02-01',
      }),
    );
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

describe('useLlmSettingsQuery', () => {
  it('fetches the backend-adjustable default LLM model', async () => {
    fetchLlmSettings.mockResolvedValue({ defaultModel: 'openai/gpt-4o-mini' });

    const { result } = renderHook(() => useLlmSettingsQuery(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchLlmSettings).toHaveBeenCalledWith();
    expect(result.current.data).toEqual({ defaultModel: 'openai/gpt-4o-mini' });
  });
});

describe('useWorkflowInfoQuery', () => {
  it('fetches each sub-workflow\'s real prompt template/schema info', async () => {
    const workflowInfo = [
      {
        workflow: 'keyword_mapping',
        label: '關鍵字對應技術',
        steps: [
          {
            stepLabel: '關鍵字→技術映射',
            toolName: 'classify_keyword_to_tech',
            systemPrompt: 'You classify keywords...',
            inputSchema: { type: 'object' },
          },
        ],
      },
    ];
    fetchWorkflowInfo.mockResolvedValue(workflowInfo);

    const { result } = renderHook(() => useWorkflowInfoQuery(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchWorkflowInfo).toHaveBeenCalledWith();
    expect(result.current.data).toEqual(workflowInfo);
  });
});
