import {
  DEFAULT_PREFERENCE_REASON,
  MAX_PREFERENCE_REASON_LENGTH,
  isDefaultReason,
  normalizeReason,
} from './preference-reason';

describe('preference-reason constants', () => {
  it('uses 未分類 as the default reason', () => {
    expect(DEFAULT_PREFERENCE_REASON).toBe('未分類');
  });

  it('caps reason length at 20', () => {
    expect(MAX_PREFERENCE_REASON_LENGTH).toBe(20);
  });
});

describe('normalizeReason', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeReason('  遠端工作  ')).toEqual({
      ok: true,
      value: '遠端工作',
    });
  });

  it('keeps inner whitespace', () => {
    expect(normalizeReason(' a  b ')).toEqual({ ok: true, value: 'a  b' });
  });

  it('rejects an empty string', () => {
    expect(normalizeReason('')).toEqual({ ok: false, error: 'empty' });
  });

  it('rejects a whitespace-only string', () => {
    expect(normalizeReason(' \t\n　 ')).toEqual({ ok: false, error: 'empty' });
  });

  it('accepts a single character', () => {
    expect(normalizeReason('a')).toEqual({ ok: true, value: 'a' });
  });

  it('accepts exactly 20 characters', () => {
    const name = '字'.repeat(20);
    expect(normalizeReason(name)).toEqual({ ok: true, value: name });
  });

  it('rejects 21 characters', () => {
    expect(normalizeReason('字'.repeat(21))).toEqual({
      ok: false,
      error: 'too_long',
    });
  });

  it('checks the length after trimming', () => {
    const name = 'a'.repeat(20);
    expect(normalizeReason(`   ${name}   `)).toEqual({ ok: true, value: name });
  });

  it('counts an emoji as one character', () => {
    const twenty = '😀'.repeat(20);
    expect(twenty.length).toBe(40);
    expect(normalizeReason(twenty)).toEqual({ ok: true, value: twenty });
    expect(normalizeReason('😀'.repeat(21))).toEqual({
      ok: false,
      error: 'too_long',
    });
  });

  it('accepts the default reason', () => {
    expect(normalizeReason(DEFAULT_PREFERENCE_REASON)).toEqual({
      ok: true,
      value: DEFAULT_PREFERENCE_REASON,
    });
  });
});

describe('isDefaultReason', () => {
  it('returns true for the default reason', () => {
    expect(isDefaultReason('未分類')).toBe(true);
  });

  it('returns false for other reasons', () => {
    expect(isDefaultReason('遠端工作')).toBe(false);
    expect(isDefaultReason('')).toBe(false);
  });
});
