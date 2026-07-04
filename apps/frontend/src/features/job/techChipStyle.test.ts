import { describe, expect, it } from 'vitest';

import { techChipClass } from './techChipStyle';

describe('techChipClass', () => {
  it('returns the selected-state hardcoded HEX classes', () => {
    expect(techChipClass(true)).toBe('bg-[#003d92] text-white');
  });

  it('returns the unselected-state hardcoded HEX classes', () => {
    expect(techChipClass(false)).toBe('bg-[#d9f2ff] text-[#434653]');
  });

  it('returns distinct class strings for selected vs unselected', () => {
    expect(techChipClass(true)).not.toBe(techChipClass(false));
  });
});
