/**
 * Task 1.1: trivial placeholder spec proving the new Vitest wiring
 * (vite.config.mts) works end-to-end for this package, which previously had
 * no test infrastructure at all. Real backend-selection/TTL/degradation
 * behavior is covered by later tasks (1.2, 2.x).
 */
import { getAppCacheModule } from './service-cache';

describe('getAppCacheModule', () => {
  it('is defined', () => {
    expect(getAppCacheModule).toBeDefined();
    expect(getAppCacheModule()).toBeDefined();
  });
});
