import { describe, expect, it } from 'vitest';

import { RequireToCrawlJob } from '../@types';
import { HandoffMinimalItem } from '../handoff/types';
import { JobDetailOnHTML } from './@types';
import { buildPersistItem } from './formatter';
import { toRawItemFromMinimal } from './handoff-adapter';

/**
 * Task 2.4: `toRawItemFromMinimal` converts a degraded-capture
 * `HandoffMinimalItem` (Requirement 2.2) into a Cake `JobOnAPI & {id:string}`
 * shape that the EXISTING, unmodified `buildPersistItem`/`cookRawJob`
 * (`apps/crawler/src/cake/formatter.ts`) can consume without any changes
 * (Requirement 4.4). The literal observable-completion criterion is that
 * feeding the adapter's output through the real `buildPersistItem` produces
 * a `PersistItem` whose `job.location`/`company_id`/`company.name` match the
 * input `HandoffMinimalItem`'s `location`/`companyId`/`companyName` -- so
 * every test below drives the REAL `buildPersistItem`, not just the
 * adapter's raw output shape.
 */

function buildMinimalItem(
  overrides: Partial<HandoffMinimalItem> = {},
): HandoffMinimalItem {
  const item = new HandoffMinimalItem();
  item.url =
    'https://www.cake.me/companies/cust-001/jobs/senior-backend-engineer';
  item.title = '資深後端工程師';
  item.location = '台北市信義區';
  item.companyName = '測試股份有限公司';
  item.companyId = 'cust-001';
  item.tags = ['後端', 'Node.js'];
  Object.assign(item, overrides);
  return item;
}

function buildDetailFixture(
  overrides: Partial<JobDetailOnHTML> = {},
): JobDetailOnHTML {
  return {
    description: '負責後端服務開發與維運',
    salary: '月薪 70,000 元以上',
    company_type: '軟體及網路相關業',
    location: '台北市信義區',
    ...overrides,
  };
}

/**
 * Attaches the `RequireToCrawlJob` fields `buildPersistItem` also expects
 * (`title`/`url`/`existingItem`/`needToCreate`) on top of the adapter's raw
 * `JobOnAPI & {id:string}` output -- mirrors how the real ingestion flow
 * merges these in (list-page transformItem sets `title`/`url`, the
 * new/existing resolution seam sets `existingItem`/`needToCreate`), matching
 * the fixture pattern already used by `cake/formatter.spec.ts`.
 */
function toRequireToCrawlJob(
  raw: ReturnType<typeof toRawItemFromMinimal>,
  overrides: Partial<RequireToCrawlJob> = {},
): ReturnType<typeof toRawItemFromMinimal> & RequireToCrawlJob {
  return {
    ...raw,
    id: raw.id,
    title: raw.title,
    url: `https://www.cake.me/companies/${raw.page.path}/jobs/${raw.path}`,
    existingItem: undefined,
    needToCreate: true,
    ...overrides,
  };
}

describe('toRawItemFromMinimal', () => {
  it('(a) fully-populated item (companyId + tags provided) fed through the real buildPersistItem yields job.location/company_id/company.name matching the input', () => {
    const minimal = buildMinimalItem();
    const raw = toRawItemFromMinimal(minimal);
    const job = toRequireToCrawlJob(raw);
    const detail = buildDetailFixture();

    const result = buildPersistItem([])(job, detail);

    expect(result).toBeDefined();
    expect(result?.job.location).toBe(minimal.location);
    expect(result?.job.company_id).toBe(minimal.companyId);
    expect(result?.company?.name).toBe(minimal.companyName);
  });

  it('(b) item WITHOUT companyId: company_id is derived from the URL structure and still matches expectations', () => {
    const minimal = buildMinimalItem({ companyId: undefined });
    const raw = toRawItemFromMinimal(minimal);
    const job = toRequireToCrawlJob(raw);
    const detail = buildDetailFixture();

    const result = buildPersistItem([])(job, detail);

    // URL is https://www.cake.me/companies/cust-001/jobs/senior-backend-engineer
    // -> companyPath derived from URL must be 'cust-001'.
    expect(result?.job.company_id).toBe('cust-001');
    expect(result?.company?.id).toBe('cust-001');
    expect(result?.job.location).toBe(minimal.location);
    expect(result?.company?.name).toBe(minimal.companyName);
  });

  it('(c) tags provided: end up correctly reflected in the persisted description via buildPersistItem Tags-append behavior', () => {
    const minimal = buildMinimalItem({ tags: ['後端', 'Node.js'] });
    const raw = toRawItemFromMinimal(minimal);
    const job = toRequireToCrawlJob(raw);
    const detail = buildDetailFixture({ description: '負責後端服務開發與維運' });

    const result = buildPersistItem([])(job, detail);

    expect(result?.job.description).toBe(
      '負責後端服務開發與維運\nTags: 後端, Node.js',
    );
  });

  it('(c) tags omitted: defaults to empty array, does not crash, and produces a harmless empty Tags suffix', () => {
    const minimal = buildMinimalItem({ tags: undefined });
    const raw = toRawItemFromMinimal(minimal);

    expect(raw.tags).toEqual([]);

    const job = toRequireToCrawlJob(raw);
    const detail = buildDetailFixture({ description: '負責後端服務開發與維運' });

    expect(() => buildPersistItem([])(job, detail)).not.toThrow();
    const result = buildPersistItem([])(job, detail);
    expect(result?.job.description).toBe('負責後端服務開發與維運\nTags: ');
  });

  it('(d) malformed url (does not match the expected Cake companies/.../jobs/... structure) throws a descriptive error', () => {
    const minimal = buildMinimalItem({
      url: 'https://www.cake.me/jobs/senior-backend-engineer',
    });

    expect(() => toRawItemFromMinimal(minimal)).toThrow();
    try {
      toRawItemFromMinimal(minimal);
      throw new Error('expected toRawItemFromMinimal to throw');
    } catch (err) {
      expect((err as Error).message).toMatch(/cake\.me/i);
    }
  });

  it('(d) malformed url with extra/missing path segments also throws', () => {
    const minimal = buildMinimalItem({
      url: 'https://www.cake.me/companies/cust-001/senior-backend-engineer',
    });

    expect(() => toRawItemFromMinimal(minimal)).toThrow();
  });

  it('(e) id/path fields are correctly derived and consistent with each other', () => {
    const minimal = buildMinimalItem();
    const raw = toRawItemFromMinimal(minimal);

    expect(raw.id).toBe('senior-backend-engineer');
    expect(raw.path).toBe('senior-backend-engineer');
    expect(raw.id).toBe(raw.path);
    expect(raw.page.path).toBe('cust-001');
  });

  it('(e) recomputing the detail URL from the adapter output (mirroring cake/handler.ts transformItem) reproduces the original HandoffMinimalItem.url', () => {
    const minimal = buildMinimalItem();
    const raw = toRawItemFromMinimal(minimal);

    const recomputedUrl = `https://www.cake.me/companies/${raw.page.path}/jobs/${raw.path}`;

    expect(recomputedUrl).toBe(minimal.url);
  });
});
