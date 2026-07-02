import * as fs from 'fs';
import * as path from 'path';
import { Page } from 'puppeteer';
import { describe, expect, it, vi } from 'vitest';

import {
  createStealthLaunchContext,
  createStealthPreNavigationHook,
} from './stealth-launch';

const DEFAULT_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--window-size=1280,800',
  '--no-first-run',
  '--lang=zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
];

const DEFAULT_VIEWPORT = { width: 1280, height: 800 };

const DEFAULT_HEADERS = {
  'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8',
  'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
};

describe('createStealthLaunchContext', () => {
  it('produces the exact default launchOptions when called with no args', () => {
    const context = createStealthLaunchContext();

    expect(context.launchOptions.headless).toBe(true);
    expect(context.launchOptions.args).toEqual(DEFAULT_ARGS);
    expect(context.launchOptions.executablePath).toBeUndefined();
    expect(context.launcher).toBeDefined();
  });

  it('overrides only executablePath, leaving all other defaults unchanged', () => {
    const context = createStealthLaunchContext({
      executablePath: '/custom/path',
    });

    expect(context.launchOptions.executablePath).toBe('/custom/path');
    expect(context.launchOptions.headless).toBe(true);
    expect(context.launchOptions.args).toEqual(DEFAULT_ARGS);
  });

  it('overrides only headless', () => {
    const context = createStealthLaunchContext({ headless: false });

    expect(context.launchOptions.headless).toBe(false);
    expect(context.launchOptions.args).toEqual(DEFAULT_ARGS);
    expect(context.launchOptions.executablePath).toBeUndefined();
  });

  it('produces a --window-size arg reflecting a windowSize override', () => {
    const context = createStealthLaunchContext({
      windowSize: { width: 1920, height: 1080 },
    });

    expect(context.launchOptions.args).toContain(
      '--window-size=1920,1080',
    );
    expect(context.launchOptions.args).not.toContain(
      '--window-size=1280,800',
    );
    // Every other default arg should remain present.
    const otherDefaults = DEFAULT_ARGS.filter(
      arg => !arg.startsWith('--window-size='),
    );
    for (const arg of otherDefaults) {
      expect(context.launchOptions.args).toContain(arg);
    }
  });

  it('appends extraArgs to the fixed default args instead of replacing them', () => {
    const context = createStealthLaunchContext({
      extraArgs: ['--some-flag'],
    });

    expect(context.launchOptions.args).toEqual([
      ...DEFAULT_ARGS,
      '--some-flag',
    ]);
  });
});

describe('createStealthPreNavigationHook', () => {
  it('calls page.setViewport and page.setExtraHTTPHeaders with default values when no overrides are given', async () => {
    const setViewport = vi.fn().mockResolvedValue(undefined);
    const setExtraHTTPHeaders = vi.fn().mockResolvedValue(undefined);
    const mockPage = {
      setViewport,
      setExtraHTTPHeaders,
    } as unknown as Page;

    const hook = createStealthPreNavigationHook();
    await hook({ page: mockPage });

    expect(setViewport).toHaveBeenCalledWith(DEFAULT_VIEWPORT);
    expect(setExtraHTTPHeaders).toHaveBeenCalledWith(DEFAULT_HEADERS);
  });

  it('merges viewport and headers overrides with defaults, override taking precedence per key', async () => {
    const setViewport = vi.fn().mockResolvedValue(undefined);
    const setExtraHTTPHeaders = vi.fn().mockResolvedValue(undefined);
    const mockPage = {
      setViewport,
      setExtraHTTPHeaders,
    } as unknown as Page;

    const hook = createStealthPreNavigationHook({
      viewport: { width: 1920, height: 1080 },
      headers: { 'sec-ch-ua-platform': '"macOS"' },
    });
    await hook({ page: mockPage });

    expect(setViewport).toHaveBeenCalledWith({
      width: 1920,
      height: 1080,
    });
    expect(setExtraHTTPHeaders).toHaveBeenCalledWith({
      ...DEFAULT_HEADERS,
      'sec-ch-ua-platform': '"macOS"',
    });
  });
});

describe('stealth-launch.ts source text', () => {
  it('does not read process.env or import dotenv anywhere in the implementation', () => {
    const sourcePath = path.resolve(__dirname, './stealth-launch.ts');
    const source = fs.readFileSync(sourcePath, 'utf-8');

    expect(source).not.toMatch(/process\.env/);
    expect(source).not.toMatch(/dotenv/);
  });
});
