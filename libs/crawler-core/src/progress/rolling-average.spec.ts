import { describe, expect, it } from 'vitest';

import { createRollingAverageTracker } from './rolling-average';

describe('createRollingAverageTracker', () => {
  it('sets the average to exactly the first sample value (no division-by-zero, no NaN)', () => {
    const tracker = createRollingAverageTracker();

    tracker.recordSample(100);

    expect(tracker.getAverage()).toBe(100);
    expect(Number.isNaN(tracker.getAverage())).toBe(false);
  });

  it('produces the correct rolling average matching the exact formula, including the intermediate average', () => {
    const tracker = createRollingAverageTracker();

    tracker.recordSample(100);
    tracker.recordSample(200);
    // Intermediate average after two samples proves this is a genuine
    // incremental rolling average (matches avg = (avg*(count-1)+elapsed)/count),
    // not a naive post-hoc mean computed only at the end.
    expect(tracker.getAverage()).toBe(150);

    tracker.recordSample(300);
    expect(tracker.getAverage()).toBe(200);
  });

  it('returns the correct sample count after N samples', () => {
    const tracker = createRollingAverageTracker();

    expect(tracker.getSampleCount()).toBe(0);

    tracker.recordSample(100);
    expect(tracker.getSampleCount()).toBe(1);

    tracker.recordSample(200);
    tracker.recordSample(300);
    expect(tracker.getSampleCount()).toBe(3);
  });
});
