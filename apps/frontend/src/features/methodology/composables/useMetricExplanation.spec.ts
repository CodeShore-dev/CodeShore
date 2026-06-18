import { describe, expect, it } from 'vitest';

import { metricExplanations } from '../content/metrics';
import type { MetricKey } from '../content/types';
import { useMetricExplanation } from './useMetricExplanation';

describe('useMetricExplanation', () => {
  it('returns the registered explanation and deep link for a known key', () => {
    const key: MetricKey = 'home.salaryBenchmark';
    const entry = metricExplanations[key];

    const result = useMetricExplanation(key);

    expect(result.explanation).toBe(entry);
    expect(result.deepLink).toBe(
      `/methodology#${entry.anchor}`,
    );
  });

  it('returns null explanation and deep link for an unregistered key', () => {
    const unknownKey = 'not.a.real.metric' as MetricKey;

    const result = useMetricExplanation(unknownKey);

    expect(result.explanation).toBeNull();
    expect(result.deepLink).toBeNull();
  });
});
