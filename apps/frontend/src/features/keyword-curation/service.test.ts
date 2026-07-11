import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get, post } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('../../httpClient', () => ({
  httpClient: { get, post },
}));

import {
  bulkExcludeKeywords,
  fetchQueue,
  resumeSession,
  startSession,
} from './service';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchQueue', () => {
  it('calls GET /api/keyword-curation/queue with default page 1/pageSize 10 and returns the parsed response', async () => {
    const keywords = [{ id: 'react', count: 42, affectedJobCount: 10 }];
    get.mockResolvedValue({ data: { keywords, totalCount: 1 } });

    const result = await fetchQueue();

    expect(get).toHaveBeenCalledWith('/api/keyword-curation/queue', {
      params: { page: 1, pageSize: 10 },
    });
    expect(result).toEqual({ keywords, totalCount: 1 });
  });

  it('passes the given page/pageSize through as query params', async () => {
    get.mockResolvedValue({ data: { keywords: [], totalCount: 0 } });

    await fetchQueue(2, 5);

    expect(get).toHaveBeenCalledWith('/api/keyword-curation/queue', {
      params: { page: 2, pageSize: 5 },
    });
  });
});

describe('bulkExcludeKeywords', () => {
  it('calls POST /api/keyword-curation/bulk-bin with { keywords }', async () => {
    post.mockResolvedValue({ data: { ok: true } });

    await bulkExcludeKeywords(['blockchain', 'web3']);

    expect(post).toHaveBeenCalledWith('/api/keyword-curation/bulk-bin', {
      keywords: ['blockchain', 'web3'],
    });
  });
});

describe('startSession', () => {
  it('calls POST /api/keyword-curation/session with a { keyword } body', async () => {
    const interrupt = { path: 'C' as const, reasoning: 'noise', affectedJobCount: 3 };
    post.mockResolvedValue({ data: { threadId: 't1', interrupt } });

    const result = await startSession('react');

    expect(post).toHaveBeenCalledWith('/api/keyword-curation/session', {
      keyword: 'react',
    });
    expect(result).toEqual({ threadId: 't1', interrupt });
  });
});

describe('resumeSession', () => {
  it('calls POST /api/keyword-curation/session/:threadId/resume with a { decision } body', async () => {
    const result = { ok: true as const, changes: [] };
    post.mockResolvedValue({ data: { status: 'done', result } });
    const decision = { path: 'C' as const };

    const response = await resumeSession('t1', decision);

    expect(post).toHaveBeenCalledWith(
      '/api/keyword-curation/session/t1/resume',
      { decision },
    );
    expect(response).toEqual({ status: 'done', result });
  });

  it('URL-encodes the threadId path segment', async () => {
    post.mockResolvedValue({
      data: { status: 'done', result: { ok: true, changes: [] } },
    });

    await resumeSession('t 1/x', { path: 'C' });

    expect(post).toHaveBeenCalledWith(
      '/api/keyword-curation/session/t%201%2Fx/resume',
      { decision: { path: 'C' } },
    );
  });
});
