import { describe, expect, it, vi } from 'vitest';

import { createBatchAccumulator } from './batch-accumulator';

describe('createBatchAccumulator', () => {
  it('does not trigger onFlush when the accumulated count is below the threshold', async () => {
    const onFlush = vi.fn().mockResolvedValue(undefined);
    const accumulator = createBatchAccumulator<string>({
      resolveBatchSize: () => 3,
      onFlush,
    });

    await accumulator.push('a');
    await accumulator.push('b');

    expect(onFlush).not.toHaveBeenCalled();
  });

  it('triggers onFlush with exactly the accumulated items once the threshold is reached, then resets', async () => {
    const onFlush = vi.fn().mockResolvedValue(undefined);
    const accumulator = createBatchAccumulator<string>({
      resolveBatchSize: () => 2,
      onFlush,
    });

    await accumulator.push('a');
    expect(onFlush).not.toHaveBeenCalled();

    await accumulator.push('b');
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith(['a', 'b']);

    // A subsequent push must not include the already-flushed items.
    await accumulator.push('c');
    expect(onFlush).toHaveBeenCalledTimes(1);
  });

  it('does not call onFlush when flushRemaining is called on an empty accumulator', async () => {
    const onFlush = vi.fn().mockResolvedValue(undefined);
    const accumulator = createBatchAccumulator<string>({
      resolveBatchSize: () => 5,
      onFlush,
    });

    await accumulator.flushRemaining();

    expect(onFlush).not.toHaveBeenCalled();
  });

  it('flushes the remainder when flushRemaining is called on a non-empty, below-threshold accumulator', async () => {
    const onFlush = vi.fn().mockResolvedValue(undefined);
    const accumulator = createBatchAccumulator<string>({
      resolveBatchSize: () => 10,
      onFlush,
    });

    await accumulator.push('a');
    await accumulator.push('b');
    expect(onFlush).not.toHaveBeenCalled();

    await accumulator.flushRemaining();

    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith(['a', 'b']);

    // Calling flushRemaining again on the now-empty accumulator must not
    // trigger another flush.
    await accumulator.flushRemaining();
    expect(onFlush).toHaveBeenCalledTimes(1);
  });

  it('calls resolveBatchSize freshly on each push rather than caching it once', async () => {
    const onFlush = vi.fn().mockResolvedValue(undefined);
    let threshold = 5;
    const resolveBatchSize = vi.fn(() => threshold);
    const accumulator = createBatchAccumulator<string>({
      resolveBatchSize,
      onFlush,
    });

    await accumulator.push('a');
    expect(onFlush).not.toHaveBeenCalled();
    expect(resolveBatchSize).toHaveBeenCalledTimes(1);

    // Lower the threshold between pushes; the accumulator should notice
    // immediately on the next push rather than using a stale cached value.
    threshold = 1;

    await accumulator.push('b');
    expect(resolveBatchSize).toHaveBeenCalledTimes(2);
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith(['a', 'b']);
  });
});
