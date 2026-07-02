import { addExtra, type VanillaPuppeteer } from 'puppeteer-extra';
import rebrowserPuppeteer from 'rebrowser-puppeteer';

// `puppeteer-extra-plugin-stealth` ships a CJS `export =` declaration, so it
// must be imported via `import ... = require(...)` to remain valid regardless
// of whether the consuming tsconfig enables `esModuleInterop`.
import StealthPlugin = require('puppeteer-extra-plugin-stealth');

export interface StealthLaunchOverrides {
  headless?: boolean;
  executablePath?: string;
  extraArgs?: string[];
  windowSize?: { width: number; height: number };
}

export interface StealthNavigationOverrides {
  viewport?: { width: number; height: number };
  headers?: Record<string, string>;
}

export interface StealthLaunchContext {
  launcher: unknown; // puppeteer-extra 產生的 launcher 實例,型別對齊 crawlee LaunchContext['launcher']
  launchOptions: {
    headless: boolean;
    args: string[];
    executablePath?: string;
  };
}

export type PreNavigationHook = (crawlingContext: {
  page: import('puppeteer').Page;
}) => Promise<void>;

const DEFAULT_WINDOW_SIZE = { width: 1280, height: 800 };

const DEFAULT_VIEWPORT = { width: 1280, height: 800 };

const DEFAULT_HEADERS: Record<string, string> = {
  'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8',
  'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
};

function buildDefaultArgs(windowSize: {
  width: number;
  height: number;
}): string[] {
  return [
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    `--window-size=${windowSize.width},${windowSize.height}`,
    '--no-first-run',
    '--lang=zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
  ];
}

/**
 * 建立防偵測瀏覽器啟動設定,組裝 puppeteer-extra + stealth 外掛。
 * 不讀取任何環境變數或 `.env` 檔案(對應需求 7.2);
 * `executablePath` 僅由 `overrides.executablePath` 決定,呼叫端須自行解析環境變數後傳入。
 */
export function createStealthLaunchContext(
  overrides?: StealthLaunchOverrides,
): StealthLaunchContext {
  const puppeteer = addExtra(
    rebrowserPuppeteer as unknown as VanillaPuppeteer,
  );
  puppeteer.use(StealthPlugin());

  const windowSize = overrides?.windowSize ?? DEFAULT_WINDOW_SIZE;
  const args = buildDefaultArgs(windowSize);
  const extraArgs = overrides?.extraArgs ?? [];

  return {
    launcher: puppeteer,
    launchOptions: {
      headless: overrides?.headless ?? true,
      args: [...args, ...extraArgs],
      executablePath: overrides?.executablePath,
    },
  };
}

/**
 * 建立 pre-navigation hook,套用一致的視窗尺寸與請求標頭(對應需求 2.3)。
 * 允許以 overrides 覆寫預設的 viewport/headers,headers 依 key 合併,override 優先。
 */
export function createStealthPreNavigationHook(
  overrides?: StealthNavigationOverrides,
): PreNavigationHook {
  const viewport = overrides?.viewport ?? DEFAULT_VIEWPORT;
  const headers = { ...DEFAULT_HEADERS, ...overrides?.headers };

  return async ({ page }) => {
    await page.setViewport(viewport);
    await page.setExtraHTTPHeaders(headers);
  };
}
