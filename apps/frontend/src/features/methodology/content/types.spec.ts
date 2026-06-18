import { describe, expect, it } from 'vitest';

import type { MetricExplanation } from './types';

// Sanity spec confirming the Vitest environment runs (Task 1.2).
// Importing a type-only module compiles, and a trivial assertion executes.
describe('methodology content types', () => {
  it('runs under the Vitest environment', () => {
    const sample: MetricExplanation = {
      key: 'home.statRow',
      title: 'title',
      source: 'source',
      scope: 'scope',
      formula: 'formula',
      aggregation: 'aggregation',
      updateFrequency: 'updateFrequency',
      anchor: 'data-crawler',
    };

    expect(sample.key).toBe('home.statRow');
  });
});
