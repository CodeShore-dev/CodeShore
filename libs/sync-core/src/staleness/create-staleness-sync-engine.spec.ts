import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PreNavigationHook, StealthLaunchContext } from '@codeshore/crawler-core';
import type { StalenessSyncConfig } from './types';

interface TestEntity {
  id: string;
  value: string;
}

interface TestDetail {
  content: string;
}

type FakeRequestHandler = (ctx: {
  request: { url: string; userData: { entity: TestEntity } };
  page: { waitForSelector: ReturnType<typeof vi.fn>; evaluate: ReturnType<typeof vi.fn> };
  log: { info: (msg: string) => void; warning: (msg: string) => void; error: (msg: string) => void };
}) => Promise<void>;

// `createStalenessSyncEngine` builds and runs its own `PuppeteerCrawler`
// (per design.md's `run(stealthConfig, preNavigationHook)` signature), so
// these tests mock `crawlee`'s `PuppeteerCrawler` to capture the
// `requestHandler` the engine wires up, then invoke that handler directly
// with a fake Puppeteer-like `page` (only `waitForSelector`/`evaluate` are
// exercised by the engine, matching `StalenessSyncConfig`'s
// `waitSelectorForHost`/`extractDetailForHost` contract) instead of
// launching a real browser.
const { puppeteerCrawlerMock, lastCrawlerOptions } = vi.hoisted(() => {
  const options: { current: { requestHandler: FakeRequestHandler } | undefined } = {
    current: undefined,
  };
  const ctor = vi.fn().mockImplementation((opts: { requestHandler: FakeRequestHandler }) => {
    options.current = opts;
    return { run: vi.fn().mockResolvedValue(undefined) };
  });
  return { puppeteerCrawlerMock: ctor, lastCrawlerOptions: options };
});

vi.mock('crawlee', async importOriginal => {
  const actual = await importOriginal<typeof import('crawlee')>();
  return {
    ...actual,
    PuppeteerCrawler: puppeteerCrawlerMock,
  };
});

// Imported AFTER the vi.mock call so the mocked module is used internally by
// `create-staleness-sync-engine.ts`.
import { createStalenessSyncEngine } from './create-staleness-sync-engine';

function createFakePage(
  overrides: Partial<{
    waitForSelector: ReturnType<typeof vi.fn>;
    evaluate: ReturnType<typeof vi.fn>;
  }> = {},
) {
  return {
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    // Mirrors real Puppeteer's `page.evaluate(fn)`: invokes the function it
    // is given (here, `StalenessSyncConfig['extractDetailForHost']`'s
    // returned extraction function) rather than returning a canned value,
    // so each test's own `extractDetailForHost` stub actually drives the result.
    evaluate: vi.fn().mockImplementation((fn: () => unknown) => fn()),
    ...overrides,
  };
}

function createBaseConfig(
  overrides: Partial<StalenessSyncConfig<TestEntity, TestDetail>> = {},
): StalenessSyncConfig<TestEntity, TestDetail> {
  return {
    fetchStaleEntities: async () => [
      { id: 'entity-1', value: 'old-1' },
      { id: 'entity-2', value: 'old-2' },
    ],
    resolveDetailUrl: entity => `https://example.test/detail/${entity.id}`,
    resolveHost: url => new URL(url).host,
    waitSelectorForHost: () => '.detail-root',
    extractDetailForHost: () => async () => ({ content: 'extracted' }),
    diffAndBuildUpdate: (entity, detail) => {
      if (detail === undefined) {
        return { action: 'close', entity };
      }
      if (detail.content === entity.value) {
        return { action: 'unchanged', entity };
      }
      return { action: 'update', entity: { ...entity, value: detail.content } };
    },
    // Explicit `batchSize: 1` (rather than relying on the engine's `?? 1`
    // default) so every pre-existing test in this file keeps its original
    // "one entity in, one onBatchReady call out" assertion regardless of how
    // batch accumulation is implemented internally — batching with a
    // threshold of 1 flushes immediately per push, same observable behavior
    // as the task 4.2 stopgap these tests were written against.
    batchSize: 1,
    onBatchReady: vi.fn().mockResolvedValue(undefined),
    logger: {
      info: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    },
    ...overrides,
  };
}

const STEALTH_CONFIG = {
  launcher: {},
  launchOptions: { headless: true, args: [] as string[] },
} satisfies StealthLaunchContext;

const PRE_NAVIGATION_HOOK: PreNavigationHook = async () => undefined;

function getRequestHandler(): FakeRequestHandler {
  if (!lastCrawlerOptions.current) {
    throw new Error('PuppeteerCrawler was not constructed');
  }
  return lastCrawlerOptions.current.requestHandler;
}

describe('createStalenessSyncEngine', () => {
  beforeEach(() => {
    puppeteerCrawlerMock.mockClear();
    lastCrawlerOptions.current = undefined;
  });

  it("resolves the correct host and invokes that host's wait-selector and extraction functions for a stale entity", async () => {
    const waitSelectorForHost = vi.fn().mockReturnValue('.host-specific-selector');
    const extractFn = vi.fn().mockResolvedValue({ content: 'new-content' });
    const extractDetailForHost = vi.fn().mockReturnValue(extractFn);
    const resolveHost = vi.fn().mockReturnValue('example.test');

    const config = createBaseConfig({
      fetchStaleEntities: async () => [{ id: 'entity-1', value: 'old' }],
      resolveHost,
      waitSelectorForHost,
      extractDetailForHost,
    });

    const engine = createStalenessSyncEngine(config);
    await engine.run(STEALTH_CONFIG, PRE_NAVIGATION_HOOK);

    const requestHandler = getRequestHandler();
    const page = createFakePage();
    const request = {
      url: 'https://example.test/detail/entity-1',
      userData: { entity: { id: 'entity-1', value: 'old' } },
    };

    await requestHandler({ request, page, log: config.logger! });

    expect(resolveHost).toHaveBeenCalledWith('https://example.test/detail/entity-1');
    expect(waitSelectorForHost).toHaveBeenCalledWith('example.test');
    expect(extractDetailForHost).toHaveBeenCalledWith('example.test');
    expect(page.waitForSelector).toHaveBeenCalledWith(
      '.host-specific-selector',
      expect.any(Object),
    );
    expect(extractFn).toHaveBeenCalledTimes(1);
  });

  it("produces the 'update' action and updated entity when diffAndBuildUpdate reports changed content", async () => {
    const onBatchReady = vi.fn().mockResolvedValue(undefined);
    const config = createBaseConfig({
      fetchStaleEntities: async () => [{ id: 'entity-1', value: 'old-content' }],
      extractDetailForHost: () => async () => ({ content: 'new-content' }),
      onBatchReady,
    });

    const engine = createStalenessSyncEngine(config);
    await engine.run(STEALTH_CONFIG, PRE_NAVIGATION_HOOK);

    const requestHandler = getRequestHandler();
    const page = createFakePage();
    const request = {
      url: 'https://example.test/detail/entity-1',
      userData: { entity: { id: 'entity-1', value: 'old-content' } },
    };

    await requestHandler({ request, page, log: config.logger! });

    expect(onBatchReady).toHaveBeenCalledTimes(1);
    expect(onBatchReady).toHaveBeenCalledWith([{ id: 'entity-1', value: 'new-content' }]);
  });

  it("produces the 'unchanged' action (still calling onBatchReady with the timestamp-only entity) when diffAndBuildUpdate reports no change", async () => {
    const onBatchReady = vi.fn().mockResolvedValue(undefined);
    const config = createBaseConfig({
      fetchStaleEntities: async () => [{ id: 'entity-1', value: 'same-content' }],
      extractDetailForHost: () => async () => ({ content: 'same-content' }),
      onBatchReady,
    });

    const engine = createStalenessSyncEngine(config);
    await engine.run(STEALTH_CONFIG, PRE_NAVIGATION_HOOK);

    const requestHandler = getRequestHandler();
    const page = createFakePage();
    const request = {
      url: 'https://example.test/detail/entity-1',
      userData: { entity: { id: 'entity-1', value: 'same-content' } },
    };

    await requestHandler({ request, page, log: config.logger! });

    expect(onBatchReady).toHaveBeenCalledTimes(1);
    expect(onBatchReady).toHaveBeenCalledWith([{ id: 'entity-1', value: 'same-content' }]);
  });

  it("produces the 'close' action when extraction yields no valid content (extractDetailForHost's function returns undefined)", async () => {
    const onBatchReady = vi.fn().mockResolvedValue(undefined);
    const config = createBaseConfig({
      fetchStaleEntities: async () => [{ id: 'entity-1', value: 'whatever' }],
      extractDetailForHost: () => async () => undefined,
      onBatchReady,
    });

    const engine = createStalenessSyncEngine(config);
    await engine.run(STEALTH_CONFIG, PRE_NAVIGATION_HOOK);

    const requestHandler = getRequestHandler();
    const page = createFakePage();
    const request = {
      url: 'https://example.test/detail/entity-1',
      userData: { entity: { id: 'entity-1', value: 'whatever' } },
    };

    await requestHandler({ request, page, log: config.logger! });

    expect(onBatchReady).toHaveBeenCalledTimes(1);
    expect(onBatchReady).toHaveBeenCalledWith([{ id: 'entity-1', value: 'whatever' }]);
  });

  it("isolates a single entity's processing failure: logs the error and still processes a subsequent entity normally in the same run", async () => {
    const onBatchReady = vi.fn().mockResolvedValue(undefined);
    const errorLogger = vi.fn();
    const extractDetailForHost = vi
      .fn()
      .mockReturnValueOnce(async () => {
        throw new Error('extraction blew up for entity-1');
      })
      .mockReturnValueOnce(async () => ({ content: 'new-content-2' }));

    const config = createBaseConfig({
      fetchStaleEntities: async () => [
        { id: 'entity-1', value: 'old-1' },
        { id: 'entity-2', value: 'old-2' },
      ],
      extractDetailForHost,
      onBatchReady,
      logger: { info: vi.fn(), warning: vi.fn(), error: errorLogger },
    });

    const engine = createStalenessSyncEngine(config);
    await engine.run(STEALTH_CONFIG, PRE_NAVIGATION_HOOK);

    const requestHandler = getRequestHandler();

    // First entity: processing throws inside extraction.
    const page1 = createFakePage();
    await requestHandler({
      request: {
        url: 'https://example.test/detail/entity-1',
        userData: { entity: { id: 'entity-1', value: 'old-1' } },
      },
      page: page1,
      log: config.logger!,
    });

    // Error must be recorded, no rethrow to the caller (already proven by
    // not throwing above), and onBatchReady must NOT have been called for
    // the failed entity.
    expect(errorLogger).toHaveBeenCalledTimes(1);
    expect(onBatchReady).not.toHaveBeenCalled();

    // Second entity in the SAME run must still be processed normally.
    const page2 = createFakePage();
    await requestHandler({
      request: {
        url: 'https://example.test/detail/entity-2',
        userData: { entity: { id: 'entity-2', value: 'old-2' } },
      },
      page: page2,
      log: config.logger!,
    });

    expect(onBatchReady).toHaveBeenCalledTimes(1);
    expect(onBatchReady).toHaveBeenCalledWith([{ id: 'entity-2', value: 'new-content-2' }]);
    expect(page2.waitForSelector).toHaveBeenCalledTimes(1);
  });

  it('runs fetchStaleEntities and passes the resulting requests into the crawler run', async () => {
    const fetchStaleEntities = vi.fn().mockResolvedValue([
      { id: 'entity-1', value: 'a' },
      { id: 'entity-2', value: 'b' },
    ]);
    const config = createBaseConfig({ fetchStaleEntities });

    const engine = createStalenessSyncEngine(config);
    await engine.run(STEALTH_CONFIG, PRE_NAVIGATION_HOOK);

    expect(fetchStaleEntities).toHaveBeenCalledTimes(1);
    const crawlerInstance = puppeteerCrawlerMock.mock.results[0].value as {
      run: ReturnType<typeof vi.fn>;
    };
    expect(crawlerInstance.run).toHaveBeenCalledTimes(1);
    const runRequests = crawlerInstance.run.mock.calls[0][0];
    expect(runRequests).toEqual([
      {
        url: 'https://example.test/detail/entity-1',
        userData: { entity: { id: 'entity-1', value: 'a' } },
      },
      {
        url: 'https://example.test/detail/entity-2',
        userData: { entity: { id: 'entity-2', value: 'b' } },
      },
    ]);
  });

  describe('batch accumulation (task 4.3)', () => {
    it('does not call onBatchReady while the accumulated count is below batchSize', async () => {
      const onBatchReady = vi.fn().mockResolvedValue(undefined);
      const config = createBaseConfig({
        fetchStaleEntities: async () => [
          { id: 'entity-1', value: 'old-1' },
          { id: 'entity-2', value: 'old-2' },
          { id: 'entity-3', value: 'old-3' },
        ],
        extractDetailForHost: () => async () => ({ content: 'new-content' }),
        batchSize: 3,
        onBatchReady,
      });

      const engine = createStalenessSyncEngine(config);
      await engine.run(STEALTH_CONFIG, PRE_NAVIGATION_HOOK);
      const requestHandler = getRequestHandler();

      await requestHandler({
        request: {
          url: 'https://example.test/detail/entity-1',
          userData: { entity: { id: 'entity-1', value: 'old-1' } },
        },
        page: createFakePage(),
        log: config.logger!,
      });
      await requestHandler({
        request: {
          url: 'https://example.test/detail/entity-2',
          userData: { entity: { id: 'entity-2', value: 'old-2' } },
        },
        page: createFakePage(),
        log: config.logger!,
      });

      expect(onBatchReady).not.toHaveBeenCalled();
    });

    it('triggers onBatchReady with exactly the accumulated batch once the threshold is reached, then resets so later entities do not reappear', async () => {
      const onBatchReady = vi.fn().mockResolvedValue(undefined);
      const config = createBaseConfig({
        fetchStaleEntities: async () => [
          { id: 'entity-1', value: 'old-1' },
          { id: 'entity-2', value: 'old-2' },
          { id: 'entity-3', value: 'old-3' },
        ],
        extractDetailForHost: () => async () => ({ content: 'new-content' }),
        batchSize: 2,
        onBatchReady,
      });

      const engine = createStalenessSyncEngine(config);
      await engine.run(STEALTH_CONFIG, PRE_NAVIGATION_HOOK);
      const requestHandler = getRequestHandler();

      await requestHandler({
        request: {
          url: 'https://example.test/detail/entity-1',
          userData: { entity: { id: 'entity-1', value: 'old-1' } },
        },
        page: createFakePage(),
        log: config.logger!,
      });
      expect(onBatchReady).not.toHaveBeenCalled();

      await requestHandler({
        request: {
          url: 'https://example.test/detail/entity-2',
          userData: { entity: { id: 'entity-2', value: 'old-2' } },
        },
        page: createFakePage(),
        log: config.logger!,
      });

      expect(onBatchReady).toHaveBeenCalledTimes(1);
      expect(onBatchReady).toHaveBeenCalledWith([
        { id: 'entity-1', value: 'new-content' },
        { id: 'entity-2', value: 'new-content' },
      ]);

      // Third entity: accumulator must have reset, so it must not reappear
      // alongside a stale batch when eventually flushed.
      await requestHandler({
        request: {
          url: 'https://example.test/detail/entity-3',
          userData: { entity: { id: 'entity-3', value: 'old-3' } },
        },
        page: createFakePage(),
        log: config.logger!,
      });

      expect(onBatchReady).toHaveBeenCalledTimes(1);
    });

    it('flushes remaining below-threshold accumulated entities at the end of run() via flushRemaining', async () => {
      const onBatchReady = vi.fn().mockResolvedValue(undefined);
      const config = createBaseConfig({
        fetchStaleEntities: async () => [
          { id: 'entity-1', value: 'old-1' },
          { id: 'entity-2', value: 'old-2' },
          { id: 'entity-3', value: 'old-3' },
        ],
        extractDetailForHost: () => async () => ({ content: 'new-content' }),
        batchSize: 2,
        onBatchReady,
      });

      // This test asserts on end-of-run() flush behavior, so the mocked
      // crawler's `run()` must actually invoke the captured requestHandler
      // for each request (mirroring real Crawlee) — otherwise `engine.run()`
      // would resolve (calling `flushRemaining()`) before any entity is ever
      // pushed into the accumulator, which doesn't reflect real execution
      // order.
      puppeteerCrawlerMock.mockImplementationOnce((opts: { requestHandler: FakeRequestHandler }) => {
        lastCrawlerOptions.current = opts;
        return {
          run: vi.fn().mockImplementation(async (requests: Array<{ url: string; userData: { entity: TestEntity } }>) => {
            for (const request of requests) {
              await opts.requestHandler({ request, page: createFakePage(), log: config.logger! });
            }
          }),
        };
      });

      const engine = createStalenessSyncEngine(config);
      await engine.run(STEALTH_CONFIG, PRE_NAVIGATION_HOOK);

      // entity-1 + entity-2 flush as a full batch of 2; entity-3 alone is
      // below the threshold, so it must be sent via the end-of-run flush.
      expect(onBatchReady).toHaveBeenCalledTimes(2);
      expect(onBatchReady).toHaveBeenNthCalledWith(1, [
        { id: 'entity-1', value: 'new-content' },
        { id: 'entity-2', value: 'new-content' },
      ]);
      expect(onBatchReady).toHaveBeenNthCalledWith(2, [
        { id: 'entity-3', value: 'new-content' },
      ]);
    });

    it('does not call onBatchReady again on flushRemaining when the batch divided evenly (no remainder)', async () => {
      const onBatchReady = vi.fn().mockResolvedValue(undefined);
      const config = createBaseConfig({
        fetchStaleEntities: async () => [
          { id: 'entity-1', value: 'old-1' },
          { id: 'entity-2', value: 'old-2' },
        ],
        extractDetailForHost: () => async () => ({ content: 'new-content' }),
        batchSize: 2,
        onBatchReady,
      });

      const engine = createStalenessSyncEngine(config);
      await engine.run(STEALTH_CONFIG, PRE_NAVIGATION_HOOK);
      const requestHandler = getRequestHandler();

      await requestHandler({
        request: {
          url: 'https://example.test/detail/entity-1',
          userData: { entity: { id: 'entity-1', value: 'old-1' } },
        },
        page: createFakePage(),
        log: config.logger!,
      });
      await requestHandler({
        request: {
          url: 'https://example.test/detail/entity-2',
          userData: { entity: { id: 'entity-2', value: 'old-2' } },
        },
        page: createFakePage(),
        log: config.logger!,
      });

      expect(onBatchReady).toHaveBeenCalledTimes(1);
    });
  });

  describe('progress/ETA tracking (task 4.3)', () => {
    it('logs processed count, total count, average duration, and estimated remaining time after processing an entity', async () => {
      const infoLogger = vi.fn();
      const config = createBaseConfig({
        fetchStaleEntities: async () => [
          { id: 'entity-1', value: 'old-1' },
          { id: 'entity-2', value: 'old-2' },
        ],
        extractDetailForHost: () => async () => ({ content: 'new-content' }),
        logger: { info: infoLogger, warning: vi.fn(), error: vi.fn() },
      });

      const engine = createStalenessSyncEngine(config);
      await engine.run(STEALTH_CONFIG, PRE_NAVIGATION_HOOK);
      const requestHandler = getRequestHandler();

      await requestHandler({
        request: {
          url: 'https://example.test/detail/entity-1',
          userData: { entity: { id: 'entity-1', value: 'old-1' } },
        },
        page: createFakePage(),
        log: config.logger!,
      });

      // Progress logging must report processed/total counts plus average
      // and ETA information (mirroring `reCrawlJobs`'s
      // `[update] ${processedCount} / ${totalCount} | avg: ... | eta: ...`
      // format) — assert on recognizable content rather than the exact
      // string, since the precise wording is an implementation detail.
      const progressCalls = infoLogger.mock.calls
        .map(call => call[0] as string)
        .filter(msg => msg.includes('1') && msg.includes('2'));
      expect(progressCalls.length).toBeGreaterThan(0);
      expect(
        progressCalls.some(msg => /avg/i.test(msg) || /average/i.test(msg)),
      ).toBe(true);
      expect(
        progressCalls.some(msg => /eta/i.test(msg) || /remaining/i.test(msg)),
      ).toBe(true);
    });

    it('still records a progress sample (processed count advances) for an entity whose processing throws, matching the "always sample" behavior of the original reCrawlJobs', async () => {
      const infoLogger = vi.fn();
      const errorLogger = vi.fn();
      const extractDetailForHost = vi
        .fn()
        .mockReturnValueOnce(async () => {
          throw new Error('boom');
        })
        .mockReturnValueOnce(async () => ({ content: 'new-content-2' }));

      const config = createBaseConfig({
        fetchStaleEntities: async () => [
          { id: 'entity-1', value: 'old-1' },
          { id: 'entity-2', value: 'old-2' },
        ],
        extractDetailForHost,
        logger: { info: infoLogger, warning: vi.fn(), error: errorLogger },
      });

      const engine = createStalenessSyncEngine(config);
      await engine.run(STEALTH_CONFIG, PRE_NAVIGATION_HOOK);
      const requestHandler = getRequestHandler();

      await requestHandler({
        request: {
          url: 'https://example.test/detail/entity-1',
          userData: { entity: { id: 'entity-1', value: 'old-1' } },
        },
        page: createFakePage(),
        log: config.logger!,
      });

      expect(errorLogger).toHaveBeenCalledTimes(1);
      // Even though entity-1's processing threw, a progress line reporting
      // "1" processed must still have been logged.
      const progressCallsAfterFailure = infoLogger.mock.calls
        .map(call => call[0] as string)
        .filter(msg => /1/.test(msg) && (/avg/i.test(msg) || /average/i.test(msg)));
      expect(progressCallsAfterFailure.length).toBeGreaterThan(0);

      await requestHandler({
        request: {
          url: 'https://example.test/detail/entity-2',
          userData: { entity: { id: 'entity-2', value: 'old-2' } },
        },
        page: createFakePage(),
        log: config.logger!,
      });

      const progressCallsAfterSecond = infoLogger.mock.calls
        .map(call => call[0] as string)
        .filter(msg => /2/.test(msg) && (/avg/i.test(msg) || /average/i.test(msg)));
      expect(progressCallsAfterSecond.length).toBeGreaterThan(0);
    });
  });
});
