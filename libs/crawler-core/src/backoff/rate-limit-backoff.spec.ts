import { describe, expect, it, vi } from 'vitest';

import type { CrawlStopReason } from '../router/types';
import { createLinearBackoffSchedule, runWithRateLimitBackoff } from './rate-limit-backoff';

const MINUTE = 60_000;

const rateLimited = (url = 'https://example.com/jobs?page=3'): CrawlStopReason => ({
  kind: 'rate-limited',
  url,
  status: 429,
  message: `Rate limited (HTTP 429) on ${url}`,
});

const createLogger = () => ({ info: vi.fn(), warning: vi.fn(), error: vi.fn() });

describe('createLinearBackoffSchedule', () => {
  it('grows linearly: initial + (n - 1) * increment', () => {
    const delay = createLinearBackoffSchedule({ initialDelayMs: 5 * MINUTE, incrementMs: 5 * MINUTE });
    expect(delay(1)).toBe(5 * MINUTE);
    expect(delay(2)).toBe(10 * MINUTE);
    expect(delay(3)).toBe(15 * MINUTE);
  });

  it('lets initial and increment differ', () => {
    const delay = createLinearBackoffSchedule({ initialDelayMs: 2 * MINUTE, incrementMs: 3 * MINUTE });
    expect(delay(1)).toBe(2 * MINUTE);
    expect(delay(2)).toBe(5 * MINUTE);
    expect(delay(4)).toBe(11 * MINUTE);
  });

  it('caps the delay at maxDelayMs when provided', () => {
    const delay = createLinearBackoffSchedule({
      initialDelayMs: 5 * MINUTE,
      incrementMs: 5 * MINUTE,
      maxDelayMs: 12 * MINUTE,
    });
    expect(delay(2)).toBe(10 * MINUTE);
    expect(delay(3)).toBe(12 * MINUTE);
    expect(delay(10)).toBe(12 * MINUTE);
  });

  it('rejects negative or non-finite inputs', () => {
    expect(() => createLinearBackoffSchedule({ initialDelayMs: -1, incrementMs: 0 })).toThrow();
    expect(() => createLinearBackoffSchedule({ initialDelayMs: 0, incrementMs: NaN })).toThrow();
  });
});

describe('runWithRateLimitBackoff', () => {
  it('returns immediately without sleeping when the first attempt completes', async () => {
    const sleep = vi.fn<[number], Promise<void>>(async () => undefined);
    const logger = createLogger();
    const attempt = vi.fn(async () => ({}));

    const summary = await runWithRateLimitBackoff(attempt, {
      delayForRetry: () => 5 * MINUTE,
      sleep,
      logger,
    });

    expect(attempt).toHaveBeenCalledTimes(1);
    expect(attempt).toHaveBeenCalledWith(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(summary).toEqual({
      succeeded: true,
      retries: 0,
      totalWaitMs: 0,
      succeededAfterWaitMs: 0,
      history: [],
    });
  });

  it('waits 5m, then 10m, then 15m between retries and records which wait preceded the success', async () => {
    const sleep = vi.fn<[number], Promise<void>>(async () => undefined);
    const logger = createLogger();
    const attempt = vi
      .fn<[number], Promise<{ stopReason?: CrawlStopReason }>>()
      .mockResolvedValueOnce({ stopReason: rateLimited('https://a') })
      .mockResolvedValueOnce({ stopReason: rateLimited('https://b') })
      .mockResolvedValueOnce({ stopReason: rateLimited('https://c') })
      .mockResolvedValueOnce({});

    const summary = await runWithRateLimitBackoff(attempt, {
      delayForRetry: createLinearBackoffSchedule({ initialDelayMs: 5 * MINUTE, incrementMs: 5 * MINUTE }),
      sleep,
      logger,
      label: '104',
    });

    expect(attempt.mock.calls.map(([n]) => n)).toEqual([1, 2, 3, 4]);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([5 * MINUTE, 10 * MINUTE, 15 * MINUTE]);
    expect(summary.succeeded).toBe(true);
    expect(summary.retries).toBe(3);
    expect(summary.totalWaitMs).toBe(30 * MINUTE);
    expect(summary.succeededAfterWaitMs).toBe(15 * MINUTE);
    expect(summary.history.map(h => [h.retry, h.waitMs, h.reason.url])).toEqual([
      [1, 5 * MINUTE, 'https://a'],
      [2, 10 * MINUTE, 'https://b'],
      [3, 15 * MINUTE, 'https://c'],
    ]);

    // The success log must state which retry succeeded and how long the wait before it was.
    const successLog = logger.info.mock.calls.map(([m]) => m as string).find(m => m.includes('succeeded'));
    expect(successLog).toContain('[104]');
    expect(successLog).toContain('retry #3');
    expect(successLog).toContain('15m 0s');
    expect(successLog).toContain('30m 0s');

    // Each backoff wait is logged before sleeping, with the stop reason.
    expect(logger.warning).toHaveBeenCalledTimes(3);
    expect(logger.warning.mock.calls[0][0]).toContain('Waiting 5m 0s before retry #1');
    expect(logger.warning.mock.calls[0][0]).toContain('https://a');
    expect(logger.warning.mock.calls[2][0]).toContain('Waiting 15m 0s before retry #3');
  });

  it('gives up after maxRetries and reports the last stop reason without throwing', async () => {
    const sleep = vi.fn<[number], Promise<void>>(async () => undefined);
    const logger = createLogger();
    const attempt = vi.fn(async () => ({ stopReason: rateLimited() }));

    const summary = await runWithRateLimitBackoff(attempt, {
      delayForRetry: () => MINUTE,
      maxRetries: 2,
      sleep,
      logger,
    });

    expect(attempt).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(summary.succeeded).toBe(false);
    expect(summary.retries).toBe(2);
    expect(summary.succeededAfterWaitMs).toBeUndefined();
    expect(summary.lastStopReason?.kind).toBe('rate-limited');
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0][0]).toContain('Giving up after 2 retries');
  });

  it('with maxRetries=0 never sleeps and gives up after the first rate-limited attempt', async () => {
    const sleep = vi.fn<[number], Promise<void>>(async () => undefined);
    const attempt = vi.fn(async () => ({ stopReason: rateLimited() }));

    const summary = await runWithRateLimitBackoff(attempt, {
      delayForRetry: () => MINUTE,
      maxRetries: 0,
      sleep,
      logger: createLogger(),
    });

    expect(attempt).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(summary.succeeded).toBe(false);
  });

  it('propagates an exception thrown by attempt (only stop reasons trigger backoff)', async () => {
    const sleep = vi.fn<[number], Promise<void>>(async () => undefined);
    const attempt = vi.fn(async () => {
      throw new Error('boom');
    });

    await expect(
      runWithRateLimitBackoff(attempt, { delayForRetry: () => MINUTE, sleep, logger: createLogger() }),
    ).rejects.toThrow('boom');
    expect(sleep).not.toHaveBeenCalled();
  });
});
