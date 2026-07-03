import { describe, expect, it } from 'vitest';

import * as syncCore from './index';

describe('sync-core test harness smoke check', () => {
  it('runs a trivial assertion to prove vitest wiring works', () => {
    expect(1 + 1).toBe(2);
  });

  it('imports the package barrel without throwing', () => {
    expect(typeof syncCore).toBe('object');
  });
});
