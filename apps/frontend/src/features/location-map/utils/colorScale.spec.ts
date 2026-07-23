import { describe, expect, it } from 'vitest';

import { getRegionColor, REGION_COLOR_STEPS } from './colorScale';

// Task 4.2 — pure choropleth color-scale helper (design.md「utils/colorScale.ts」,
// requirements 2.1, 2.2, 3.3, 4.4). Fixtures cover the edge cases the
// requirements call out explicitly: 0 → lightest step regardless of
// maxValue, maxValue → darkest step, monotonic ordering for values in
// between, and an empty dataset (`maxValue === 0`) not dividing by zero.
describe('getRegionColor', () => {
  it('maps value 0 to the lightest step regardless of maxValue', () => {
    expect(getRegionColor(0, 100)).toBe(REGION_COLOR_STEPS[0]);
    expect(getRegionColor(0, 1)).toBe(REGION_COLOR_STEPS[0]);
    expect(getRegionColor(0, 999_999)).toBe(REGION_COLOR_STEPS[0]);
  });

  it('maps a value equal to maxValue to the darkest step', () => {
    expect(getRegionColor(100, 100)).toBe(
      REGION_COLOR_STEPS[REGION_COLOR_STEPS.length - 1],
    );
    expect(getRegionColor(1, 1)).toBe(
      REGION_COLOR_STEPS[REGION_COLOR_STEPS.length - 1],
    );
  });

  it('never crashes and always returns the lightest step when maxValue is 0 (empty dataset)', () => {
    expect(getRegionColor(0, 0)).toBe(REGION_COLOR_STEPS[0]);
    expect(getRegionColor(5, 0)).toBe(REGION_COLOR_STEPS[0]);
    expect(getRegionColor(-1, 0)).toBe(REGION_COLOR_STEPS[0]);
  });

  it('maps intermediate values monotonically: a larger value never yields a lighter step than a smaller value', () => {
    const maxValue = 100;
    const values = [0, 1, 10, 25, 40, 50, 60, 75, 90, 99, 100];

    const indexes = values.map(value =>
      REGION_COLOR_STEPS.indexOf(getRegionColor(value, maxValue)),
    );

    expect(indexes.every(index => index >= 0)).toBe(true);

    for (let i = 1; i < indexes.length; i += 1) {
      expect(indexes[i]).toBeGreaterThanOrEqual(indexes[i - 1]);
    }

    // Sanity check that the scale actually spans more than one step across
    // the full range, not just lightest/darkest.
    expect(new Set(indexes).size).toBeGreaterThan(2);
  });

  it('produces the same step boundaries regardless of the absolute magnitude of maxValue (relative scaling)', () => {
    // 50% of a small dataset and 50% of a large dataset should land on the
    // same step, since the scale is relative to the current dataset's max.
    expect(getRegionColor(5, 10)).toBe(getRegionColor(500, 1000));
  });

  it('clamps out-of-range values instead of throwing or exceeding the darkest step', () => {
    expect(getRegionColor(-5, 100)).toBe(REGION_COLOR_STEPS[0]);
    expect(getRegionColor(1000, 100)).toBe(
      REGION_COLOR_STEPS[REGION_COLOR_STEPS.length - 1],
    );
  });

  it('exposes a fixed, non-empty set of color steps as hex strings', () => {
    expect(REGION_COLOR_STEPS.length).toBeGreaterThanOrEqual(5);
    for (const step of REGION_COLOR_STEPS) {
      expect(step).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
