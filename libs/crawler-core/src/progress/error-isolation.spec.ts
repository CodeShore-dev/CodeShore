import { describe, expect, it, vi } from 'vitest';

import { withErrorIsolation } from './error-isolation';

describe('withErrorIsolation', () => {
  it('resolves to the value returned by fn() when fn() resolves normally', async () => {
    const logger = { error: vi.fn() };
    const fn = vi.fn().mockResolvedValue('ok');

    const result = await withErrorIsolation(logger, 'test-context', fn);

    expect(result).toBe('ok');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('catches an asynchronous rejection from fn(), logs it via logger.error including the context, and resolves to undefined', async () => {
    const logger = { error: vi.fn() };
    const fn = vi.fn().mockRejectedValue(new Error('boom'));

    const result = await withErrorIsolation(logger, 'detail-page-123', fn);

    expect(result).toBeUndefined();
    expect(logger.error).toHaveBeenCalledTimes(1);
    const [loggedMessage] = logger.error.mock.calls[0] as [string];
    expect(loggedMessage).toContain('detail-page-123');
    expect(loggedMessage).toContain('boom');
  });

  it('catches a synchronous throw from fn(), logs it via logger.error including the context, and resolves to undefined', async () => {
    const logger = { error: vi.fn() };
    const fn = vi.fn(() => {
      throw new Error('sync boom');
    });

    const result = await withErrorIsolation(logger, 'list-page-456', fn);

    expect(result).toBeUndefined();
    expect(logger.error).toHaveBeenCalledTimes(1);
    const [loggedMessage] = logger.error.mock.calls[0] as [string];
    expect(loggedMessage).toContain('list-page-456');
    expect(loggedMessage).toContain('sync boom');
  });

  it('never rejects the returned promise even when fn() throws — the core isolation guarantee', async () => {
    const logger = { error: vi.fn() };
    const fn = vi.fn().mockRejectedValue(new Error('never propagate'));

    await expect(
      withErrorIsolation(logger, 'isolation-guarantee', fn),
    ).resolves.toBeUndefined();
  });

  it('does not call logger.error when fn() resolves normally, even with a falsy resolved value', async () => {
    const logger = { error: vi.fn() };
    const fn = vi.fn().mockResolvedValue(0);

    const result = await withErrorIsolation(logger, 'falsy-context', fn);

    expect(result).toBe(0);
    expect(logger.error).not.toHaveBeenCalled();
  });
});
