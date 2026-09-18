import type { CrawlStopReason } from '../router/types';
import { formatDuration } from '../time';

const defaultLogger = {
  info: (msg: string) => console.log(msg),
  warning: (msg: string) => console.warn(msg),
  error: (msg: string) => console.error(msg),
};

const defaultSleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export interface LinearBackoffScheduleOptions {
  /** 第 1 次重試前的等待時間(毫秒)。 */
  initialDelayMs: number;
  /** 之後每多重試一次,等待時間就再累加這麼多(毫秒)。 */
  incrementMs: number;
  /** 等待時間的上限(毫秒),未提供時不設上限。 */
  maxDelayMs?: number;
}

/**
 * 建立「線性累加」的退讓時程:第 n 次重試前等待
 * `initialDelayMs + (n - 1) * incrementMs`,例如預設 5 分鐘起、每次多 5 分鐘
 * → 5m、10m、15m、…。回傳的函式簽章即 `RunWithRateLimitBackoffOptions.
 * delayForRetry`,之後若想改成指數退讓或固定間隔,只需另外提供一個同簽章的
 * 函式,不必動 `runWithRateLimitBackoff` 本身。
 */
export function createLinearBackoffSchedule(options: LinearBackoffScheduleOptions): (retryNumber: number) => number {
  const { initialDelayMs, incrementMs, maxDelayMs } = options;
  if (!Number.isFinite(initialDelayMs) || initialDelayMs < 0) {
    throw new Error(`initialDelayMs must be a non-negative number, got ${initialDelayMs}`);
  }
  if (!Number.isFinite(incrementMs) || incrementMs < 0) {
    throw new Error(`incrementMs must be a non-negative number, got ${incrementMs}`);
  }
  return retryNumber => {
    const delay = initialDelayMs + Math.max(0, retryNumber - 1) * incrementMs;
    return maxDelayMs === undefined ? delay : Math.min(delay, maxDelayMs);
  };
}

/** 單次嘗試的結果:有 `stopReason` 代表這次被限流 / 被擋而提早收工。 */
export interface BackoffAttemptResult {
  stopReason?: CrawlStopReason;
}

export interface BackoffRetryRecord {
  /** 第幾次重試(從 1 起算)。 */
  retry: number;
  /** 這次重試前等待了多久(毫秒)。 */
  waitMs: number;
  /** 觸發這次重試的停止原因。 */
  reason: CrawlStopReason;
}

export interface BackoffRunSummary {
  /** 最後一次嘗試是否正常跑完(沒有被限流 / 被擋)。 */
  succeeded: boolean;
  /** 總共重試了幾次(不含第一次嘗試)。 */
  retries: number;
  /** 所有重試前等待時間的總和(毫秒)。 */
  totalWaitMs: number;
  /**
   * 成功的那次嘗試「之前」等待了多久(毫秒)。第一次就成功時為 0;沒有成功
   * 時為 `undefined`。這就是「隔多久的那次重試成功」的答案。
   */
  succeededAfterWaitMs: number | undefined;
  /** 每一次重試的等待時間與觸發原因,依時間順序。 */
  history: BackoffRetryRecord[];
  /** 未成功時,最後一次嘗試的停止原因。 */
  lastStopReason?: CrawlStopReason;
}

export interface RunWithRateLimitBackoffOptions {
  /** 第 n 次重試(從 1 起算)前要等待的毫秒數。見 `createLinearBackoffSchedule`。 */
  delayForRetry: (retryNumber: number) => number;
  /** 最多重試幾次;未提供時不設上限、一直重試到成功為止。 */
  maxRetries?: number;
  /** 出現在 log 前綴的名稱,用來區分多個並存的 backoff 迴圈(例如 104 / Cake)。 */
  label?: string;
  logger?: {
    info: (msg: string) => void;
    warning: (msg: string) => void;
    error: (msg: string) => void;
  };
  /** 可注入的等待實作,測試時用來取代真實的 `setTimeout`。 */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * 反覆執行 `attempt`,直到某一次沒有回報 `stopReason`(代表正常跑完)為止。
 * 每次被限流 / 被擋後,依 `delayForRetry(retryNumber)` 等待再重試,並在 log
 * 記錄:每次等多久、最後是隔多久的那次重試成功、總共等了多久。
 *
 * `attempt` 收到的 `attemptNumber` 從 1 起算(1 = 第一次、非重試)。呼叫端
 * 應在每次 `attempt` 內建立全新的 crawler(而不是重用被 stop 過的實例),
 * 並以 resume 模式重新取得待爬清單——這與操作者手動重跑的行為完全一致。
 */
export async function runWithRateLimitBackoff(
  attempt: (attemptNumber: number) => Promise<BackoffAttemptResult>,
  options: RunWithRateLimitBackoffOptions,
): Promise<BackoffRunSummary> {
  const log = options.logger ?? defaultLogger;
  const sleep = options.sleep ?? defaultSleep;
  const prefix = options.label ? `[${options.label}] ` : '';
  const history: BackoffRetryRecord[] = [];
  let totalWaitMs = 0;
  let lastWaitMs = 0;

  for (let attemptNumber = 1; ; attemptNumber++) {
    const { stopReason } = await attempt(attemptNumber);
    const retries = attemptNumber - 1;

    if (!stopReason) {
      if (retries === 0) {
        log.info(`${prefix}Crawl run completed on the first attempt (no rate-limit backoff needed).`);
      } else {
        log.info(
          `${prefix}Crawl run succeeded on retry #${retries} after waiting ${formatDuration(lastWaitMs)} ` +
            `(total backoff: ${formatDuration(totalWaitMs)} across ${retries} retr${retries === 1 ? 'y' : 'ies'}; ` +
            `waits: ${history.map(h => formatDuration(h.waitMs)).join(' → ')}).`,
        );
      }
      return {
        succeeded: true,
        retries,
        totalWaitMs,
        succeededAfterWaitMs: lastWaitMs,
        history,
      };
    }

    if (options.maxRetries !== undefined && retries >= options.maxRetries) {
      log.error(
        `${prefix}Giving up after ${retries} retr${retries === 1 ? 'y' : 'ies'} ` +
          `(total backoff: ${formatDuration(totalWaitMs)}): ${stopReason.message}`,
      );
      return {
        succeeded: false,
        retries,
        totalWaitMs,
        succeededAfterWaitMs: undefined,
        history,
        lastStopReason: stopReason,
      };
    }

    const retryNumber = retries + 1;
    const waitMs = options.delayForRetry(retryNumber);
    history.push({ retry: retryNumber, waitMs, reason: stopReason });
    totalWaitMs += waitMs;
    lastWaitMs = waitMs;

    log.warning(
      `${prefix}${stopReason.message} (${stopReason.kind}). ` +
        `Waiting ${formatDuration(waitMs)} before retry #${retryNumber}` +
        (options.maxRetries !== undefined ? ` of ${options.maxRetries}` : '') +
        ` (resume mode; total backoff so far: ${formatDuration(totalWaitMs)}).`,
    );
    await sleep(waitMs);
    log.info(`${prefix}Backoff finished — starting retry #${retryNumber}.`);
  }
}
