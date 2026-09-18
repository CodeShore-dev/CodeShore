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

const USER_DATA_DIR_ARG_PREFIX = '--user-data-dir=';

/**
 * 判斷 `userDataDir` 是不是「在非 Windows 平台上收到的 Windows 路徑」(如 WSL 下
 * 呼叫 Windows Chrome 時的 `C:\\Users\\...`)。這種路徑對 Linux 端的 Node `fs` 而言
 * 只是一個含反斜線的相對目錄名,任何以它為基底的 `path.join`/`fs.mkdir` 都會在
 * cwd 底下建出字面上叫 `C:\Users\...` 的資料夾。
 */
export function isForeignWindowsPath(userDataDir: string, platform: NodeJS.Platform = process.platform): boolean {
  return platform !== 'win32' && /^[A-Za-z]:[\\/]/.test(userDataDir);
}

/**
 * 包裝 puppeteer launcher,在最底層 `launch` 前處理 `launchOptions.userDataDir`:
 *
 * - `args` 已含 `--user-data-dir=`(`createStealthLaunchContext` 針對 WSL 下的
 *   Windows 路徑會這樣做):直接移除 `userDataDir`、不再另外加參數——此時的
 *   `userDataDir` 是 stealth 附帶的 user-data-dir 外掛在沒收到值時自行建立的
 *   Linux 暫存目錄,不能讓它蓋掉真正要給 chrome.exe 的 Windows 路徑。
 * - 否則把 `userDataDir` 改以 `--user-data-dir=` 參數原樣傳給 Chrome,避免
 *   rebrowser-puppeteer-core 對它做 `path.resolve()`。
 */
function withRawUserDataDir(base: VanillaPuppeteer): VanillaPuppeteer {
  const wrapped: VanillaPuppeteer = Object.create(base);
  wrapped.launch = (options?: Parameters<VanillaPuppeteer['launch']>[0]) => {
    if (!options?.userDataDir) return base.launch(options);
    const { userDataDir, ...rest } = options;
    const args = rest.args ?? [];
    if (args.some(arg => arg.startsWith(USER_DATA_DIR_ARG_PREFIX))) {
      return base.launch({ ...rest, args });
    }
    return base.launch({
      ...rest,
      args: [...args, `${USER_DATA_DIR_ARG_PREFIX}${userDataDir}`],
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
 *
 * Windows 路徑在非 Windows 平台上不會放進 `launchOptions.userDataDir`,而是直接以
 * `--user-data-dir=` 參數放進 `args`:stealth 附帶的 user-data-dir 外掛會在啟動前用
 * Node `fs` 往 `userDataDir/Default/Preferences` 寫檔,Linux 端拿到 `C:\\...` 只會在
 * cwd 底下建出一個字面上叫 `C:\Users\...` 的垃圾資料夾。改走 `args` 之後外掛看不到
 * 這個值,會自行建立(並在關閉時清掉)一個 Linux 暫存目錄,而 chrome.exe 仍拿到
 * 正確的 Windows 路徑(見 `withRawUserDataDir`)。
 */
export function createStealthLaunchContext(overrides?: StealthLaunchOverrides): StealthLaunchContext {
  const puppeteer = addExtra(withRawUserDataDir(rebrowserPuppeteer as unknown as VanillaPuppeteer));
  puppeteer.use(StealthPlugin());

  const windowSize = overrides?.windowSize ?? DEFAULT_WINDOW_SIZE;
  const args = buildDefaultArgs(windowSize);
  const extraArgs = overrides?.extraArgs ?? [];

  const userDataDir = overrides?.userDataDir;
  const userDataDirIsForeign = userDataDir !== undefined && isForeignWindowsPath(userDataDir);

  return {
    launcher: puppeteer,
    launchOptions: {
      headless: overrides?.headless ?? true,
      args: [
        ...args,
        ...extraArgs,
        ...(userDataDirIsForeign ? [`${USER_DATA_DIR_ARG_PREFIX}${userDataDir}`] : []),
      ],
      executablePath: overrides?.executablePath,
      userDataDir: userDataDirIsForeign ? undefined : userDataDir,
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
