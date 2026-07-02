import { Page } from 'puppeteer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { humanScroll, randomDelay, randomViewport } from './human-behavior';

const VIEW_PORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1366, height: 768 },
  { width: 1280, height: 800 },
];

describe('randomDelay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('schedules a setTimeout whose delay is within the default [1500, 4000] range', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    const promise = randomDelay();
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    const delay = setTimeoutSpy.mock.calls[0][1] as number;
    expect(delay).toBeGreaterThanOrEqual(1500);
    expect(delay).toBeLessThanOrEqual(4000);

    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBeUndefined();
  });

  it('schedules a setTimeout whose delay is within a custom [min, max] range', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    const promise = randomDelay(100, 200);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    const delay = setTimeoutSpy.mock.calls[0][1] as number;
    expect(delay).toBeGreaterThanOrEqual(100);
    expect(delay).toBeLessThanOrEqual(200);

    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBeUndefined();
  });

  it('produces the minimum delay when Math.random returns 0', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    const promise = randomDelay(1000, 2000);
    const delay = setTimeoutSpy.mock.calls[0][1] as number;
    expect(delay).toBe(1000);

    await vi.runAllTimersAsync();
    await promise;
  });

  it('produces a delay just under the max when Math.random returns just under 1', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    const promise = randomDelay(1000, 2000);
    const delay = setTimeoutSpy.mock.calls[0][1] as number;
    expect(delay).toBeGreaterThanOrEqual(1000);
    expect(delay).toBeLessThan(2000);

    await vi.runAllTimersAsync();
    await promise;
  });
});

describe('randomViewport', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a viewport that is a member of the predefined VIEW_PORTS set', () => {
    for (let i = 0; i < 50; i++) {
      const viewport = randomViewport();
      expect(VIEW_PORTS).toContainEqual(viewport);
    }
  });

  it('returns the first viewport in the set when Math.random returns 0', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(randomViewport()).toEqual(VIEW_PORTS[0]);
  });

  it('returns the last viewport in the set when Math.random returns just under 1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);
    expect(randomViewport()).toEqual(VIEW_PORTS[VIEW_PORTS.length - 1]);
  });
});

describe('humanScroll', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls page.evaluate with a function argument', async () => {
    const evaluate = vi
      .fn()
      .mockImplementation((fn: () => unknown) => fn());
    const mockPage = { evaluate } as unknown as Page;

    // Stub a browser-like environment for the evaluated callback.
    const scrollByCalls: Array<[number, number]> = [];
    (global as unknown as { document: unknown }).document = {
      body: { scrollHeight: 1000 },
    };
    (global as unknown as { window: unknown }).window = {
      scrollBy: (x: number, y: number) => scrollByCalls.push([x, y]),
    };

    vi.useFakeTimers();
    const promise = humanScroll(mockPage);
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(typeof evaluate.mock.calls[0][0]).toBe('function');

    await vi.runAllTimersAsync();
    await promise;
    vi.useRealTimers();

    expect(scrollByCalls.length).toBeGreaterThan(0);
    // target = 60% of 1000 = 600; total scrolled must reach/exceed target.
    const totalScrolled = scrollByCalls.reduce((sum, [, y]) => sum + y, 0);
    expect(totalScrolled).toBeGreaterThanOrEqual(600);

    delete (global as unknown as { document: unknown }).document;
    delete (global as unknown as { window: unknown }).window;
  });

  it('drives scroll steps whose step size is within [80, 280) and stops once 60% of scrollHeight is reached', async () => {
    const evaluate = vi
      .fn()
      .mockImplementation((fn: () => unknown) => fn());
    const mockPage = { evaluate } as unknown as Page;

    const scrollByCalls: Array<[number, number]> = [];
    (global as unknown as { document: unknown }).document = {
      body: { scrollHeight: 500 },
    };
    (global as unknown as { window: unknown }).window = {
      scrollBy: (x: number, y: number) => scrollByCalls.push([x, y]),
    };

    vi.useFakeTimers();
    const promise = humanScroll(mockPage);
    await vi.runAllTimersAsync();
    await promise;
    vi.useRealTimers();

    for (const [, amount] of scrollByCalls) {
      expect(amount).toBeGreaterThanOrEqual(80);
      expect(amount).toBeLessThan(280);
    }
    const totalScrolled = scrollByCalls.reduce((sum, [, y]) => sum + y, 0);
    expect(totalScrolled).toBeGreaterThanOrEqual(300); // 60% of 500

    delete (global as unknown as { document: unknown }).document;
    delete (global as unknown as { window: unknown }).window;
  });
});
