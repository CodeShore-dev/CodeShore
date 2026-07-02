import { describe, expect, it } from 'vitest';

import * as crawlerCore from './index';

describe('crawler-core test harness smoke check', () => {
  it('runs a trivial assertion to prove vitest wiring works', () => {
    expect(1 + 1).toBe(2);
  });

  it('imports the package barrel without throwing', () => {
    expect(typeof crawlerCore).toBe('object');
  });
});
