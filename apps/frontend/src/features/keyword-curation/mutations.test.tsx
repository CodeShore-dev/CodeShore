import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AiRecommendation, CommitResult, HumanDecision } from './service';

const { startSession, resumeSession } = vi.hoisted(() => ({
  startSession: vi.fn(),
  resumeSession: vi.fn(),
}));

vi.mock('./service', () => ({
  startSession,
  resumeSession,
}));

import { INITIAL_CURATION_STATE, useCurationStore } from './curationStore';
import { useResumeSessionMutation, useStartSessionMutation } from './mutations';

const pathARecommendation: AiRecommendation = {
  path: 'A',
  matchedTech: { id: 'reactjs', label: 'React', category: 'framework' },
  confidence: 0.92,
  reasoning: 'strong lexical match',
  affectedJobCount: 12,
};

const successResult: CommitResult = {
  ok: true,
  changes: [
    {
      type: 'tech_keyword',
      details: { keyword: 'reactjs', techId: 'reactjs' },
      status: 'committed',
    },
  ],
};

const pathADecision: HumanDecision = { path: 'A', confirmedTechId: 'reactjs' };

describe('useStartSessionMutation / useResumeSessionMutation', () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    useCurationStore.setState(INITIAL_CURATION_STATE);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  describe('useStartSessionMutation', () => {
    it('POSTs /session with the keyword', async () => {
      startSession.mockResolvedValue({
        threadId: 'thread-1',
        interrupt: pathARecommendation,
      });

      const { result } = renderHook(() => useStartSessionMutation(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync('reactjs');
      });

      expect(startSession).toHaveBeenCalledWith('reactjs');
    });

    it('on success transitions curationStore to interrupted with the threadId and interrupt payload', async () => {
      startSession.mockResolvedValue({
        threadId: 'thread-1',
        interrupt: pathARecommendation,
      });

      const { result } = renderHook(() => useStartSessionMutation(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync('reactjs');
      });

      const state = useCurationStore.getState();
      expect(state.sessionStatus).toBe('interrupted');
      expect(state.threadId).toBe('thread-1');
      expect(state.interrupt).toBe(pathARecommendation);
      expect(state.activeKeyword).toBe('reactjs');
    });

    it('sets curationStore into loading (and sets activeKeyword) before the request resolves', () => {
      startSession.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useStartSessionMutation(), {
        wrapper,
      });

      act(() => {
        result.current.mutate('vuejs');
      });

      const state = useCurationStore.getState();
      expect(state.sessionStatus).toBe('loading');
      expect(state.activeKeyword).toBe('vuejs');
    });

    it('on failure transitions curationStore to error', async () => {
      startSession.mockRejectedValue(new Error('network down'));

      const { result } = renderHook(() => useStartSessionMutation(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync('reactjs').catch(() => {});
      });

      const state = useCurationStore.getState();
      expect(state.sessionStatus).toBe('error');
      expect(state.errorMessage).toBe('network down');
    });
  });

  describe('useResumeSessionMutation', () => {
    it('POSTs /session/:id/resume with the threadId and decision', async () => {
      resumeSession.mockResolvedValue({ status: 'done', result: successResult });

      const { result } = renderHook(() => useResumeSessionMutation(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync({
          threadId: 'thread-1',
          decision: pathADecision,
        });
      });

      expect(resumeSession).toHaveBeenCalledWith('thread-1', pathADecision);
    });

    it('on success transitions curationStore to done with the CommitResult', async () => {
      resumeSession.mockResolvedValue({ status: 'done', result: successResult });

      const { result } = renderHook(() => useResumeSessionMutation(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync({
          threadId: 'thread-1',
          decision: pathADecision,
        });
      });

      const state = useCurationStore.getState();
      expect(state.sessionStatus).toBe('done');
      expect(state.commitResult).toBe(successResult);
    });

    it('on success invalidates the ["keyword-curation", "queue"] query', async () => {
      resumeSession.mockResolvedValue({ status: 'done', result: successResult });
      const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

      const { result } = renderHook(() => useResumeSessionMutation(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync({
          threadId: 'thread-1',
          decision: pathADecision,
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['keyword-curation', 'queue'],
      });
    });

    it('a stale queue query actually refetches after a successful resume', async () => {
      resumeSession.mockResolvedValue({ status: 'done', result: successResult });
      const queryFn = vi.fn().mockResolvedValue({ keywords: [] });

      // Mount an active observer on the queue queryKey (an inactive/prefetched
      // query is not auto-refetched by `invalidateQueries`'s default
      // `refetchType: 'active'`) so this test proves an actual refetch, not
      // just an `invalidateQueries` call.
      const { result: queueResult } = renderHook(
        () =>
          useQuery({ queryKey: ['keyword-curation', 'queue'], queryFn }),
        { wrapper },
      );
      await waitFor(() => expect(queueResult.current.isSuccess).toBe(true));
      expect(queryFn).toHaveBeenCalledTimes(1);

      const { result } = renderHook(() => useResumeSessionMutation(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync({
          threadId: 'thread-1',
          decision: pathADecision,
        });
      });

      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    });

    it('sets curationStore back into loading without touching activeKeyword/threadId while resuming', () => {
      useCurationStore.setState({
        ...INITIAL_CURATION_STATE,
        activeKeyword: 'reactjs',
        sessionStatus: 'interrupted',
        threadId: 'thread-1',
        interrupt: pathARecommendation,
      });
      resumeSession.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useResumeSessionMutation(), {
        wrapper,
      });

      act(() => {
        result.current.mutate({ threadId: 'thread-1', decision: pathADecision });
      });

      const state = useCurationStore.getState();
      expect(state.sessionStatus).toBe('loading');
      expect(state.activeKeyword).toBe('reactjs');
      expect(state.threadId).toBe('thread-1');
    });

    it('on failure transitions curationStore to error', async () => {
      resumeSession.mockRejectedValue(new Error('write failed'));

      const { result } = renderHook(() => useResumeSessionMutation(), {
        wrapper,
      });

      await act(async () => {
        await result.current
          .mutateAsync({ threadId: 'thread-1', decision: pathADecision })
          .catch(() => {});
      });

      const state = useCurationStore.getState();
      expect(state.sessionStatus).toBe('error');
      expect(state.errorMessage).toBe('write failed');
    });
  });
});
