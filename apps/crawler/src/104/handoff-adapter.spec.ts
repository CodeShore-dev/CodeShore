import { describe, expect, it } from 'vitest';

import { RequireToCrawlJob } from '../@types';
import { HandoffMinimalItem } from '../handoff/types';
import { JobDetailOnHTML } from './@types';
import { buildPersistItem } from './formatter';
import { toRawItemFromMinimal } from './handoff-adapter';

/**
 * Task 2.5: `toRawItemFromMinimal` converts a degraded-capture
 * `HandoffMinimalItem` (Requirement 2.2) into a 104 `JobOnAPI & {id:string}`
 * shape that the EXISTING, unmodified `buildPersistItem`/`cookRawJob`
 * (`apps/crawler/src/104/formatter.ts`) can consume without any changes
 * (Requirement 4.4). Mirrors task 2.4's Cake adapter test methodology
 * (`apps/crawler/src/cake/handoff-adapter.spec.ts`): every test below drives
 * the REAL `buildPersistItem`, not just the adapter's raw output shape.
 *
 * Unlike Cake (where the company slug is derivable from the job URL's own
 * path structure), 104's job detail URL does not embed the company's URL
 * (design.md Open Questions/Risks: "104 則沒有對應的 URL 結構可推導、需要
 * `companyLink` 欄位") -- so `HandoffMinimalItem.companyLink`, while optional
 * at the shared host-agnostic schema level, is effectively REQUIRED for 104
 * and enforced by this adapter.
 */

function buildMinimalItem(
  overrides: Partial<HandoffMinimalItem> = {},
): HandoffMinimalItem {
  const item = new HandoffMinimalItem();
  item.url = 'https://www.104.com.tw/job/8ovsc';
  item.title = '資深後端工程師';
  item.location = '台北市信義區';
  item.companyName = '測試股份有限公司';
  item.companyLink = 'https://www.104.com.tw/company/1a2b3c4';
  Object.assign(item, overrides);
  return item;
}

function buildDetailFixture(
  overrides: Partial<JobDetailOnHTML> = {},
): JobDetailOnHTML {
  return {
    description: '負責後端服務開發與維運',
    salary: '月薪 70,000 元以上',
    location: '台北市信義區',
    ...overrides,
  };
}

/**
 * Attaches the `RequireToCrawlJob` fields `buildPersistItem` also expects
 * (`title`/`url`/`existingItem`/`needToCreate`) on top of the adapter's raw
 * `JobOnAPI & {id:string}` output -- mirrors how the real ingestion flow
 * merges these in (104/handler.ts's `transformItem`: `url: job.link.job,
 * title: job.jobName`, plus the new/existing resolution seam setting
 * `existingItem`/`needToCreate`), matching the pattern used by
 * `cake/handoff-adapter.spec.ts` and `104/formatter.spec.ts`.
 */
function toRequireToCrawlJob(
  raw: ReturnType<typeof toRawItemFromMinimal>,
  overrides: Partial<RequireToCrawlJob> = {},
): ReturnType<typeof toRawItemFromMinimal> & RequireToCrawlJob {
  return {
    ...raw,
    id: raw.id,
    title: raw.jobName,
    url: raw.link.job,
    existingItem: undefined,
    needToCreate: true,
    ...overrides,
  };
}

describe('toRawItemFromMinimal (104)', () => {
  it('(a) fully-populated item (companyLink provided) fed through the real buildPersistItem yields job.location/company_id/company.name/company.link matching the input', () => {
    const minimal = buildMinimalItem();
    const raw = toRawItemFromMinimal(minimal);
    const job = toRequireToCrawlJob(raw);
    const detail = buildDetailFixture();

    const result = buildPersistItem([])(job, detail);

    expect(result).toBeDefined();
    expect(result?.job.location).toBe(minimal.location);
    expect(result?.job.company_id).toBe('1a2b3c4');
    expect(result?.company?.id).toBe('1a2b3c4');
    expect(result?.company?.name).toBe(minimal.companyName);
    expect(result?.company?.link).toBe(minimal.companyLink);
  });

  it('(b) companyLink MISSING: adapter throws a clear, descriptive error rather than silently corrupting company_id/company.link', () => {
    const minimal = buildMinimalItem({ companyLink: undefined });

    expect(() => toRawItemFromMinimal(minimal)).toThrow();
    try {
      toRawItemFromMinimal(minimal);
      throw new Error('expected toRawItemFromMinimal to throw');
    } catch (err) {
      expect((err as Error).message).toMatch(/companyLink/i);
    }
  });

  it('(c) coIndustryDesc placeholder: HandoffMinimalItem has no corresponding "company type" field, so the persisted company.type is always empty for 104 degraded captures (documented data-quality tradeoff, not a bug)', () => {
    const minimal = buildMinimalItem();
    const raw = toRawItemFromMinimal(minimal);

    expect(raw.coIndustryDesc).toBe('');

    const job = toRequireToCrawlJob(raw);
    const detail = buildDetailFixture();
    const result = buildPersistItem([])(job, detail);

    expect(result?.company?.type).toBe('');
  });

  it('(d) id/link.job consistency: id === getIdFromUrl(item.url), and link.job === item.url exactly', () => {
    const minimal = buildMinimalItem();
    const raw = toRawItemFromMinimal(minimal);

    expect(raw.id).toBe('8ovsc');
    expect(raw.link.job).toBe(minimal.url);
  });

  it('(e) recomputing url/title from the adapter output (mirroring 104/handler.ts transformItem: url: job.link.job, title: job.jobName) reproduces the original HandoffMinimalItem.url/title', () => {
    const minimal = buildMinimalItem();
    const raw = toRawItemFromMinimal(minimal);

    const recomputedUrl = raw.link.job;
    const recomputedTitle = raw.jobName;

    expect(recomputedUrl).toBe(minimal.url);
    expect(recomputedTitle).toBe(minimal.title);
  });

  it('(f) large placeholder structures (tags/interactionRecord/pcSkills/nullable fields) are present and correctly shaped -- build passing with zero type errors is the primary proof, this is a runtime sanity spot-check', () => {
    const minimal = buildMinimalItem();
    const raw = toRawItemFromMinimal(minimal);

    expect(raw.pcSkills).toHaveLength(9);
    expect(raw.tags.landmark).toEqual({ desc: '' });
    expect(raw.tags.wf7).toEqual({ desc: '', param: '' });
    expect(raw.interactionRecord.lastCustReplyTimestamp).toBeNull();
    expect(raw.isSave).toBeNull();
    expect(raw.isApplied).toBeNull();
    expect(raw.applyDate).toBeNull();
    expect(raw.userApplyCount).toBeNull();
  });
});
