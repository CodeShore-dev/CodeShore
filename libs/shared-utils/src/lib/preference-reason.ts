/** Default reason (子分類) for a job preference record. Must match the DB column default. */
export const DEFAULT_PREFERENCE_REASON = '未分類';

/** Maximum reason length in Unicode code points. Must match the DB CHECK constraint. */
export const MAX_PREFERENCE_REASON_LENGTH = 20;

export type NormalizeReasonResult =
  | { ok: true; value: string }
  | { ok: false; error: 'empty' | 'too_long' };

/**
 * Trims a reason name, then validates it.
 *
 * Length counts Unicode code points (`[...s].length`), which matches
 * PostgreSQL `char_length`. On success, `value` is trimmed and 1–20 long.
 */
export function normalizeReason(input: string): NormalizeReasonResult {
  const value = input.trim();
  const length = [...value].length;

  if (length === 0) {
    return { ok: false, error: 'empty' };
  }
  if (length > MAX_PREFERENCE_REASON_LENGTH) {
    return { ok: false, error: 'too_long' };
  }
  return { ok: true, value };
}

/** Returns true when `reason` is exactly the default reason. */
export function isDefaultReason(reason: string): boolean {
  return reason === DEFAULT_PREFERENCE_REASON;
}
