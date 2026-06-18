import { describe, expect, it } from 'vitest';
import type { RouteLocationNormalized } from 'vue-router';

import router, {
  PUBLIC_ROUTES,
  scrollBehavior,
} from './index';

describe('router methodology registration (Task 4.2)', () => {
  it('registers a lazy methodology route at /methodology', () => {
    const route = router
      .getRoutes()
      .find(r => r.name === 'methodology');

    expect(route).toBeDefined();
    expect(route?.path).toBe('/methodology');
    expect(typeof route?.components?.default).toBe(
      'function',
    );
  });

  it('marks methodology as a public route (no login required)', () => {
    expect(PUBLIC_ROUTES).toContain('methodology');
  });
});

describe('router scrollBehavior (req 7.4 deep-link)', () => {
  const makeRoute = (
    path: string,
    hash = '',
  ): RouteLocationNormalized =>
    ({ path, hash }) as unknown as RouteLocationNormalized;

  it('returns saved position when present', () => {
    const saved = { left: 0, top: 200 };
    const result = scrollBehavior(
      makeRoute('/methodology'),
      makeRoute('/'),
      saved,
    );

    expect(result).toBe(saved);
  });

  it('returns a hash element target when navigating with a hash', () => {
    const result = scrollBehavior(
      makeRoute('/methodology', '#data-crawler'),
      makeRoute('/'),
      null,
    );

    expect(result).toMatchObject({ el: '#data-crawler' });
  });

  it('returns top:0 on a path change without a hash', () => {
    const result = scrollBehavior(
      makeRoute('/methodology'),
      makeRoute('/'),
      null,
    );

    expect(result).toEqual({ top: 0 });
  });

  it('returns false on a same-path navigation without a hash', () => {
    const result = scrollBehavior(
      makeRoute('/techs'),
      makeRoute('/techs'),
      null,
    );

    expect(result).toBe(false);
  });
});
