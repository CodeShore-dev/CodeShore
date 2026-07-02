import { describe, expect, it } from 'vitest';

import { formatDuration } from './time';

describe('formatDuration', () => {
  it('formats an hours-level duration as "Xh Ym"', () => {
    const result = formatDuration(7325000); // 2h 2m 5s
    expect(result).toBe('2h 2m');
  });

  it('formats exactly one hour as the hours boundary', () => {
    const result = formatDuration(3600000); // exactly 1h
    expect(result).toBe('1h 0m');
  });

  it('formats a minutes-level duration as "Xm Ys"', () => {
    const result = formatDuration(125000); // 2m 5s
    expect(result).toBe('2m 5s');
  });

  it('formats exactly one minute as the minutes boundary', () => {
    const result = formatDuration(60000); // exactly 1m
    expect(result).toBe('1m 0s');
  });

  it('formats a seconds-level duration as "Xs Yms"', () => {
    const result = formatDuration(5000); // exactly 5s
    expect(result).toBe('5s 0ms');
  });

  it('formats a sub-second duration that rounds up into the seconds branch', () => {
    const result = formatDuration(500); // rounds to 1 total second
    expect(result).toBe('1s 500ms');
  });

  it('falls back to "Xms" for a sub-second duration that rounds down to zero', () => {
    const result = formatDuration(100);
    expect(result).toBe('100ms');
  });

  it('falls back to "0ms" for a zero duration', () => {
    const result = formatDuration(0);
    expect(result).toBe('0ms');
  });
});
