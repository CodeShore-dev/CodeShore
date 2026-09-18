import { type VanillaPuppeteer, addExtra } from 'puppeteer-extra';
import rebrowserPuppeteer from 'rebrowser-puppeteer';

// `puppeteer-extra-plugin-stealth` ships a CJS `export =` declaration, so it
// must be imported via `import ... = require(...)` to remain valid regardless
// of whether the consuming tsconfig enables `esModuleInterop`.
import StealthPlugin = require('puppeteer-extra-plugin-stealth');

export interface StealthLaunchOverrides {
  headless?: boolean;
  executablePath?: string;
  userDataDir?: string;
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
    userDataDir?: string;
  };
}

export type PreNavigationHook = (crawlingContext: { page: import('puppeteer').Page }) => Promise<void>;

const DEFAULT_WINDOW_SIZE = { width: 1280, height: 800 };

const DEFAULT_VIEWPORT = { width: 1280, height: 800 };

const DEFAULT_HEADERS: Record<string, string> = {
  'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8',
  'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
};

function buildDefaultArgs(windowSize: { width: number; height: number }): string[] {
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
 * 包裝 puppeteer launcher,把 `launchOptions.userDataDir` 改以 `--user-data-dir=` 參數原樣傳給 Chrome。
 * rebrowser-puppeteer-core 會對 `launchOptions.userDataDir` 做 `path.resolve()`,
 * 在 WSL 下會把 Windows 路徑變成 `/home/.../C:\\...`,導致 chrome.exe 啟動失敗。
 * `launchOptions.userDataDir` 仍須保留給 stealth 外掛(user-data-dir 外掛在沒有值時會自行建立 Linux 暫存目錄),
 * 因此只在最底層的 `launch` 呼叫前轉換。
 */
function withRawUserDataDir(base: VanillaPuppeteer): VanillaPuppeteer {
  const wrapped: VanillaPuppeteer = Object.create(base);
  wrapped.launch = (options?: Parameters<VanillaPuppeteer['launch']>[0]) => {
    if (!options?.userDataDir) return base.launch(options);
    const { userDataDir, ...rest } = options;
    return base.launch({
      ...rest,
      args: [...(rest.args ?? []), `--user-data-dir=${userDataDir}`],
    });
  };
  return wrapped;
}

/**
 * 建立防偵測瀏覽器啟動設定,組裝 puppeteer-extra + stealth 外掛。
 * 不讀取任何環境變數或 `.env` 檔案(對應需求 7.2);
 * `executablePath` 僅由 `overrides.executablePath` 決定,呼叫端須自行解析環境變數後傳入。
 * `userDataDir` 同理;WSL 下呼叫 Windows Chrome 時須傳入 Windows 路徑(如 `C:\\Temp\\profile`),
 * 否則 Puppeteer 產生的 Linux 暫存路徑會讓 chrome.exe 無法建立 profile。
 * 底層 launcher 以 `withRawUserDataDir` 包裝,避免 rebrowser-puppeteer-core 對路徑做 `path.resolve()`。
 */
export function createStealthLaunchContext(overrides?: StealthLaunchOverrides): StealthLaunchContext {
  const puppeteer = addExtra(withRawUserDataDir(rebrowserPuppeteer as unknown as VanillaPuppeteer));
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
      userDataDir: overrides?.userDataDir,
    },
  };
}

/**
 * 建立 pre-navigation hook,套用一致的視窗尺寸與請求標頭(對應需求 2.3)。
 * 允許以 overrides 覆寫預設的 viewport/headers,headers 依 key 合併,override 優先。
 */
export function createStealthPreNavigationHook(overrides?: StealthNavigationOverrides): PreNavigationHook {
  const viewport = overrides?.viewport ?? DEFAULT_VIEWPORT;
  const headers = { ...DEFAULT_HEADERS, ...overrides?.headers };

  return async ({ page }) => {
    await page.setViewport(viewport);
    await page.setExtraHTTPHeaders(headers);
  };
}
