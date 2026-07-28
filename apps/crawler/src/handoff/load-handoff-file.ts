import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { promises as fs } from 'fs';

import {
  HandoffCaptureMode,
  HandoffFile,
  HandoffHost,
  HandoffMinimalItem,
  HandoffPage,
} from './types';

/**
 * Requirements 3.2-3.5. Two distinct validation levels:
 *
 * - Whole-file structural validation (3.4): applies only to the top-level
 *   shape (`host`/`pages`). Any failure here rejects the entire call --
 *   nothing further is processed.
 * - Per-page / per-item validation (3.3, plus a page-level analogue for
 *   malformed individual pages that requirement 3.3 doesn't explicitly
 *   cover): a bad page or item is recorded as an issue and excluded, without
 *   affecting the rest of the file.
 */

const KNOWN_HOSTS: readonly HandoffHost[] = ['cake.me', '104.com.tw'];
const KNOWN_CAPTURE_MODES: readonly HandoffCaptureMode[] = [
  'full',
  'degraded',
];

export interface HandoffValidationIssue {
  pageIndex: number;
  itemIndex?: number;
  reason: string;
}

export interface HandoffLoadResult {
  file: HandoffFile;
  /** 通過驗證、可繼續處理的分頁（無效項目已被剔除,不影響同頁其餘有效項目）。 */
  validPages: HandoffPage[];
  issues: HandoffValidationIssue[];
}

const isKnownHost = (value: unknown): value is HandoffHost =>
  typeof value === 'string' &&
  (KNOWN_HOSTS as readonly string[]).includes(value);

const isKnownCaptureMode = (value: unknown): value is HandoffCaptureMode =>
  typeof value === 'string' &&
  (KNOWN_CAPTURE_MODES as readonly string[]).includes(value);

/**
 * Whole-file structural validation (Requirement 3.4). Throws a descriptive
 * `Error` on the first problem found -- the caller must not proceed with any
 * further processing when this fails.
 */
function assertWellFormedHandoffFile(
  parsed: unknown,
): asserts parsed is HandoffFile {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      'Handoff file structural validation failed: top-level content must be a JSON object.',
    );
  }

  const candidate = parsed as Record<string, unknown>;

  if (!isKnownHost(candidate['host'])) {
    throw new Error(
      `Handoff file structural validation failed: "host" must be one of ${KNOWN_HOSTS.join(
        ', ',
      )}, got ${JSON.stringify(candidate['host'])}.`,
    );
  }

  if (!Array.isArray(candidate['pages'])) {
    throw new Error(
      'Handoff file structural validation failed: "pages" must be an array.',
    );
  }
}

/**
 * Shallow, per-page structural check (design.md: "淺層結構驗證...逐筆欄位不做深層驗證").
 * Deeper validation of `rawResponse`'s internal shape is deferred to the
 * existing `parsePagination`/`extractItems` pure functions in a later task.
 * Returns a reason string when the page is malformed, or `undefined` when it
 * passes the shallow check.
 */
const findPageLevelIssueReason = (page: unknown): string | undefined => {
  if (typeof page !== 'object' || page === null || Array.isArray(page)) {
    return 'Page entry must be a JSON object.';
  }

  const candidate = page as Record<string, unknown>;

  if (
    typeof candidate['sourceUrl'] !== 'string' ||
    candidate['sourceUrl'] === ''
  ) {
    return 'Page is missing a non-empty "sourceUrl".';
  }

  if (
    typeof candidate['pageIndex'] !== 'number' ||
    !Number.isFinite(candidate['pageIndex'])
  ) {
    return 'Page is missing a valid numeric "pageIndex".';
  }

  if (
    typeof candidate['totalPages'] !== 'number' ||
    !Number.isFinite(candidate['totalPages'])
  ) {
    return 'Page is missing a valid numeric "totalPages".';
  }

  if (!isKnownCaptureMode(candidate['captureMode'])) {
    return `Page has an unrecognized "captureMode": ${JSON.stringify(
      candidate['captureMode'],
    )}.`;
  }

  if (candidate['captureMode'] === 'full') {
    if (
      !('rawResponse' in candidate) ||
      candidate['rawResponse'] === undefined
    ) {
      return 'Page declares captureMode "full" but is missing "rawResponse".';
    }
  }

  if (candidate['captureMode'] === 'degraded') {
    if (!Array.isArray(candidate['minimalItems'])) {
      return 'Page declares captureMode "degraded" but "minimalItems" is missing or not an array.';
    }
  }

  return undefined;
};

const summarizeConstraints = (
  constraints: Record<string, string> | undefined,
): string =>
  constraints ? Object.values(constraints).join('; ') : 'Unknown validation error.';

/**
 * Validates each item of a degraded-mode page's `minimalItems` via
 * class-validator, returning only the items that passed together with the
 * issues recorded for the ones that didn't (Requirement 3.3). Never mutates
 * the original page/items.
 */
const validateDegradedItems = async (
  page: HandoffPage,
): Promise<{ validItems: HandoffMinimalItem[]; issues: HandoffValidationIssue[] }> => {
  const items = page.minimalItems ?? [];
  const validItems: HandoffMinimalItem[] = [];
  const issues: HandoffValidationIssue[] = [];

  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const instance = plainToInstance(HandoffMinimalItem, items[itemIndex]);
    const errors = await validate(instance);

    if (errors.length === 0) {
      validItems.push(instance);
    } else {
      const reason = errors
        .map(error => summarizeConstraints(error.constraints))
        .join(' | ');
      issues.push({ pageIndex: page.pageIndex, itemIndex, reason });
    }
  }

  return { validItems, issues };
};

export async function loadHandoffFile(
  filePath: string,
): Promise<HandoffLoadResult> {
  const raw = await fs.readFile(filePath, 'utf-8');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Handoff file structural validation failed: content is not valid JSON (${
        error instanceof Error ? error.message : String(error)
      }).`,
    );
  }

  assertWellFormedHandoffFile(parsed);
  const file: HandoffFile = parsed;

  const validPages: HandoffPage[] = [];
  const issues: HandoffValidationIssue[] = [];

  for (let arrayIndex = 0; arrayIndex < file.pages.length; arrayIndex += 1) {
    const page = file.pages[arrayIndex];
    const pageLevelReason = findPageLevelIssueReason(page);

    if (pageLevelReason !== undefined) {
      // Prefer the page's own declared pageIndex as the locator; when it's
      // missing/non-numeric (the exact case this check is guarding against),
      // fall back to the page's position in the `pages` array -- always
      // available, and a far more useful locator than NaN for the user to
      // find and fix the offending entry in the handoff file.
      const declaredPageIndex = (page as { pageIndex?: unknown })?.pageIndex;
      const pageIndex =
        typeof declaredPageIndex === 'number' && Number.isFinite(declaredPageIndex)
          ? declaredPageIndex
          : arrayIndex;
      issues.push({ pageIndex, reason: pageLevelReason });
      continue;
    }

    const typedPage = page as HandoffPage;

    if (typedPage.captureMode === 'full') {
      validPages.push(typedPage);
      continue;
    }

    const { validItems, issues: itemIssues } = await validateDegradedItems(
      typedPage,
    );
    issues.push(...itemIssues);
    validPages.push({ ...typedPage, minimalItems: validItems });
  }

  return { file, validPages, issues };
}
