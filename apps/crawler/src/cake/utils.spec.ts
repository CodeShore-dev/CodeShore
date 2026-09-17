import { describe, expect, it, vi } from 'vitest';

import {
  CAKE_HOMEPAGE_URL,
  createHomepageWarmupHook,
  isTheHost,
} from './utils';

describe('isTheHost', () => {
  it('accepts the cake.me job listing host', () => {
    expect(isTheHost('www.cake.me')).toBe(true);
  });

  it('rejects any other host', () => {
    expect(isTheHost('www.104.com.tw')).toBe(false);
  });
});

describe('createHomepageWarmupHook', () => {
  it('visits the cake.me homepage before a list-page (unlabeled) request', async () => {
    const goto = vi.fn().mockResolvedValue(undefined);
    const hook = createHomepageWarmupHook();

    await hook({
      request: { label: undefined },
      page: { goto },
    } as any);

    expect(goto).toHaveBeenCalledWith(CAKE_HOMEPAGE_URL, {
      waitUntil: 'domcontentloaded',
    });
  });

  it('skips the homepage warm-up for DETAIL (job detail page) requests', async () => {
    const goto = vi.fn().mockResolvedValue(undefined);
    const hook = createHomepageWarmupHook();

    await hook({
      request: { label: 'DETAIL' },
      page: { goto },
    } as any);

    expect(goto).not.toHaveBeenCalled();
  });
});
