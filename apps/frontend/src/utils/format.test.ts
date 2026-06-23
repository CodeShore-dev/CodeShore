import { describe, expect, it } from 'vitest';

import { formatNumber, toWan, toWanInt } from './format';

// Unit coverage for the shared formatters (task 11.1, requirements 4.3, 10.2).
describe('toWan', () => {
  it('renders a round 萬 value without decimals', () => {
    expect(toWan(500000)).toBe('50萬');
  });

  it('keeps one decimal for non-round values', () => {
    expect(toWan(555000)).toBe('55.5萬');
  });

  it('returns an em dash placeholder for nullish input', () => {
    expect(toWan(null)).toBe('—');
    expect(toWan(undefined)).toBe('—');
  });
});

describe('toWanInt', () => {
  it('drops the 萬 suffix (numeric only)', () => {
    expect(toWanInt(500000)).toBe('50');
    expect(toWanInt(555000)).toBe('55.5');
  });
});

describe('formatNumber', () => {
  it('groups thousands with separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('coerces numeric strings', () => {
    expect(formatNumber('1234')).toBe('1,234');
  });

  it('falls back to 0 for non-numeric input', () => {
    expect(formatNumber('abc')).toBe('0');
  });
});

describe('salary range separator (en dash convention)', () => {
  it('joins a range with – not ~', () => {
    const range = `${toWan(400000)}–${toWan(600000)}`;
    expect(range).toBe('40萬–60萬');
    expect(range).not.toContain('~');
  });
});
