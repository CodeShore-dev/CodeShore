import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useStableNonNegative } from './useStableNonNegative';

describe('useStableNonNegative', () => {
  it('returns the value as-is when it is non-negative', () => {
    const { result } = renderHook(({ value }) => useStableNonNegative(value), {
      initialProps: { value: 10 },
    });

    expect(result.current).toBe(10);
  });

  it('keeps the last non-negative value when a later value goes negative', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useStableNonNegative(value),
      { initialProps: { value: 10 } },
    );

    expect(result.current).toBe(10);

    rerender({ value: -5 });
    expect(result.current).toBe(10);
  });

  it('adopts a new non-negative value once one arrives', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useStableNonNegative(value),
      { initialProps: { value: 10 } },
    );

    rerender({ value: -5 });
    expect(result.current).toBe(10);

    rerender({ value: 20 });
    expect(result.current).toBe(20);

    rerender({ value: -1 });
    expect(result.current).toBe(20);
  });

  it('clamps an initial negative value to 0 instead of surfacing it', () => {
    const { result } = renderHook(({ value }) => useStableNonNegative(value), {
      initialProps: { value: -3 },
    });

    expect(result.current).toBe(0);
  });
});
