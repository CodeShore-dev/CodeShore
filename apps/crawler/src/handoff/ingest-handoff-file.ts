import { Configuration, PuppeteerCrawler } from 'crawlee';

import type { CrawlItemBase, CrawlRouterResult } from '@codeshore/crawler-core';
import {
  createStealthLaunchContext,
  createStealthPreNavigationHook,
  getSourceKey,
  randomDelay,
} from '@codeshore/crawler-core';

import { JobOnAPI as Job104OnAPI, JobsAPIResponse as Job104ApiResponse } from '../104/@types';
import { toRawItemFromMinimal as toRawItemFromMinimal104 } from '../104/handoff-adapter';
import {
  createHandler as createHandler104,
  extractItems as extractItems104,
  parsePagination as parsePagination104,
} from '../104/handler';
import { JobOnAPI as CakeJobOnAPI, JobsAPIResponse as CakeJobsAPIResponse } from '../cake/@types';
import { toRawItemFromMinimal as toRawItemFromMinimalCake } from '../cake/handoff-adapter';
import {
  createHandler as createHandlerCake,
  extractItems as extractItemsCake,
  parsePagination as parsePaginationCake,
} from '../cake/handler';
import { sourceRegistry } from '../persistence';
import { HandoffValidationIssue, loadHandoffFile } from './load-handoff-file';
import { HandoffMinimalItem, HandoffPage } from './types';

/**
 * Requirements 1.2, 3.5, 4.1-4.3; design.md HandoffIngestionOrchestrator.
 * Summary of a single `ingestHandoffFile` run: how many valid pages were
 * actually fed into the crawl engine, how many were skipped because they were
 * no longer pending (Requirement 4.3), and the per-item validation issues
 * passed straight through from `loadHandoffFile` (Requirement 3.3, surfaced
 * here under `rejectedItemIssues` per design.md's exact field name).
 */
export interface HandoffIngestionSummary {
  processedPages: number;
  skippedAlreadyCompletedPages: number;
  rejectedItemIssues: HandoffValidationIssue[];
}

/**
 * `SourceLocation`/`HandoffPage` share this `(url, pageIndex)` identity, but
 * NOT the same URL shape: `sourceRegistry.fetchPendingSources()` returns
 * `SourceLocation.url` already stripped of its `page` query param (the
 * persistence layer's `upsertJobSourceURL`/`createJobSourceURLs` -- see
 * `libs/data-utils/src/lib/api/job_source_url.service.ts`'s
 * `_removePageIndexFromURL` -- always normalizes before storing; `main.ts`'s
 * `setPageIndex(x.url, x.pageIndex)` reconstruction of the page-bearing URL
 * from a bare `x.url` only makes sense under this same assumption). A handoff
 * file's `HandoffPage.sourceUrl`, by contrast, is the FULL list-page URL
 * *including* `?page=N` (design.md's own JSON example: `"sourceUrl":
 * "https://www.cake.me/jobs/...?page=1"`). Comparing the two directly would
 * therefore never match in production, silently skipping every handoff page
 * as "already completed" -- the inverse of Requirement 4.3. Callers MUST
 * normalize any `HandoffPage.sourceUrl` through `getSourceKey` (the exact
 * same page-param-stripping the persistence layer performs) before building
 * a key from it; `SourceLocation.url` is passed through unnormalized since
 * it is already base-URL-only.
 */
function buildPendingKey(url: string, pageIndex: number): string {
  return `${url}::${pageIndex}`;
}

/**
 * Converts and ingests every pending page of a single host's `validPages`
 * into that host's `CrawlRouterResult.ingestCapturedListPage` (Requirement
 * 4.1). Generic over `TListResponse`/`TRawItem` so both Cake and 104 share
 * this one implementation instead of two near-identical copies -- each call
 * site below instantiates it with its own host's concrete types, so the two
 * hosts' shapes never mix (see `router/types.ts`'s note on why
 * `ingestCapturedListPage` is declared contravariant per router instance).
 *
 * Pages absent from `pendingKeys` (Requirement 4.3: already completed, or
 * never registered) are skipped and counted, never passed to
 * `ingestCapturedListPage`. A page whose conversion throws (a malformed
 * `rawResponse` for `extractItems`/`parsePagination`, or an adapter rejecting
 * a `minimalItems` entry, e.g. 104's missing-`companyLink` guard) is logged
 * and skipped without crashing the run or incrementing either counter --
 * consistent with this feature's "one bad page must not abort the whole
 * file" philosophy (see this task's CONCERNS for the explicit rationale,
 * since design.md doesn't spell out this specific case verbatim).
 */
async function ingestPagesForHost<TListResponse, TRawItem extends CrawlItemBase>(
  pages: HandoffPage[],
  pendingKeys: ReadonlySet<string>,
  router: CrawlRouterResult<TRawItem>,
  parsePagination: (response: TListResponse) => {
    currentPage: number;
    totalPages: number;
    totalEntries: number;
  },
  extractItems: (response: TListResponse) => TRawItem[],
  toRawItemFromMinimal: (item: HandoffMinimalItem) => TRawItem,
): Promise<{ processedPages: number; skippedAlreadyCompletedPages: number }> {
  let processedPages = 0;
  let skippedAlreadyCompletedPages = 0;

  for (const page of pages) {
    // `page.sourceUrl` still carries its `?page=N` suffix; normalize through
    // `getSourceKey` (see `buildPendingKey`'s doc comment) before comparing
    // against `pendingKeys`, which was built from already-base
    // `SourceLocation.url` values.
    if (
      !pendingKeys.has(
        buildPendingKey(getSourceKey(page.sourceUrl), page.pageIndex),
      )
    ) {
      skippedAlreadyCompletedPages += 1;
      continue;
    }

    try {
      let items: TRawItem[];
      let currentPage: number;
      let totalPages: number;
      let totalEntries: number;

      if (page.captureMode === 'full') {
        const rawResponse = page.rawResponse as TListResponse;
        items = extractItems(rawResponse);
        const pagination = parsePagination(rawResponse);
        currentPage = pagination.currentPage;
        totalPages = pagination.totalPages;
        totalEntries = pagination.totalEntries;
      } else {
        // Wrapped in an explicit lambda (not passed as a bare `.map` callback):
        // `Array.prototype.map` invokes its callback with `(item, index,
        // array)`, and passing `toRawItemFromMinimal` directly would silently
        // forward those extra arguments even though its signature only wants
        // the item -- harmless today, but a needless footgun if the adapter's
        // signature ever grows an optional second parameter.
        items = (page.minimalItems ?? []).map(item =>
          toRawItemFromMinimal(item),
        );
        currentPage = page.pageIndex;
        totalPages = page.totalPages;
        totalEntries = items.length;
      }

      await router.ingestCapturedListPage({
        url: page.sourceUrl,
        currentPage,
        totalPages,
        totalEntries,
        items,
      });

      processedPages += 1;
    } catch (error) {
      console.error(
        `ingestHandoffFile: failed to convert/ingest handoff page ` +
          `(sourceUrl=${page.sourceUrl}, pageIndex=${page.pageIndex}); skipping ` +
          `this page and continuing with the rest of the file.`,
        error,
      );
    }
  }

  return { processedPages, skippedAlreadyCompletedPages };
}

/**
 * Builds and runs a `PuppeteerCrawler` that consumes only the DETAIL requests
 * pre-seeded by `ingestCapturedListPage` above -- mirrors `main.ts`'s
 * existing `crawl` mode `makeCrawlerOptions`/`PuppeteerCrawler` construction
 * SHAPE (stealth launch context, stealth pre-navigation hook plus a random
 * human-pacing delay, `maxConcurrency: 1`, `requestHandlerTimeoutSecs: 120`,
 * `Configuration.getGlobalConfig().set('purgeOnStart', true)`), but seeds
 * `crawler.run([])` with an EMPTY array since there is no list page to
 * navigate to -- design.md: "僅消化交接資料衍生的 DETAIL 請求,不嘗試導覽任何
 * 列表頁".
 */
async function runIngestionCrawler<TRawItem extends CrawlItemBase>(
  router: CrawlRouterResult<TRawItem>,
): Promise<void> {
  const launchContext = createStealthLaunchContext({
    executablePath: process.env['PUPPETEER_EXECUTABLE_PATH'] || undefined,
    headless: true,
  });
  const preNavigationHook = createStealthPreNavigationHook();

  Configuration.getGlobalConfig().set('purgeOnStart', true);

  const crawler = new PuppeteerCrawler({
    launchContext: launchContext as never,
    browserPoolOptions: {
      useFingerprints: false,
    },
    preNavigationHooks: [
      preNavigationHook as never,
      async () => {
        await randomDelay();
      },
    ],
    requestHandler: router.router,
    maxConcurrency: 1,
    requestHandlerTimeoutSecs: 120,
  });

  await crawler.run([]);
  await router.flushPending();
}

/**
 * HandoffIngestionOrchestrator (design.md). Reads and validates a handoff
 * file (Requirement 3.2-3.5, delegated to `loadHandoffFile`), routes to the
 * matching host's handler/adapter by `HandoffFile.host` (Requirement 1.2),
 * filters out pages no longer pending via the EXISTING
 * `sourceRegistry.fetchPendingSources()` (Requirement 4.3 -- no new
 * `SourceRegistry` methods are added), converts each remaining page's items
 * via the host's full-mode `extractItems`/`parsePagination` or degraded-mode
 * `toRawItemFromMinimal` adapter, feeds them into the host's
 * `ingestCapturedListPage` seam (Requirement 4.1), and finally drains the
 * resulting DETAIL request queue through a real (mocked-in-tests)
 * `PuppeteerCrawler` (Requirement 4.4).
 *
 * A whole-file structural failure from `loadHandoffFile` (Requirement 3.4)
 * is intentionally NOT caught here -- it propagates to the caller (task
 * 3.2's CLI wiring), which decides how to report it.
 */
export async function ingestHandoffFile(
  filePath: string,
  keywords: string[],
): Promise<HandoffIngestionSummary> {
  const { file, validPages, issues } = await loadHandoffFile(filePath);

  const pendingSources = await sourceRegistry.fetchPendingSources();
  const pendingKeys = new Set(
    pendingSources.map(source => buildPendingKey(source.url, source.pageIndex)),
  );

  let result: { processedPages: number; skippedAlreadyCompletedPages: number };

  if (file.host === 'cake.me') {
    const router = createHandlerCake(keywords);
    result = await ingestPagesForHost<CakeJobsAPIResponse, CakeJobOnAPI & { id: string }>(
      validPages,
      pendingKeys,
      router,
      parsePaginationCake,
      extractItemsCake,
      toRawItemFromMinimalCake,
    );
    await runIngestionCrawler(router);
  } else {
    const router = createHandler104(keywords);
    result = await ingestPagesForHost<Job104ApiResponse, Job104OnAPI & { id: string }>(
      validPages,
      pendingKeys,
      router,
      parsePagination104,
      extractItems104,
      toRawItemFromMinimal104,
    );
    await runIngestionCrawler(router);
  }

  return {
    processedPages: result.processedPages,
    skippedAlreadyCompletedPages: result.skippedAlreadyCompletedPages,
    rejectedItemIssues: issues,
  };
}
