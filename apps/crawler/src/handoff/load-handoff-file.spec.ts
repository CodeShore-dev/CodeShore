import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadHandoffFile } from './load-handoff-file';

/**
 * Requirements 3.2-3.5: loadHandoffFile must (a) validate the whole-file
 * structure and reject the entire call when it's unrecognizable (3.4), (b)
 * per-page/per-item validate the remaining content without letting one bad
 * page or item take down the rest (3.3), and (c) hand back only the pages
 * that are safe to continue processing (3.5).
 */
describe('loadHandoffFile', () => {
  const writtenFiles: string[] = [];

  afterEach(async () => {
    await Promise.all(
      writtenFiles.splice(0).map(async filePath => {
        await fs.rm(filePath, { force: true });
      }),
    );
  });

  const writeTempFile = async (content: string): Promise<string> => {
    const filePath = path.join(
      os.tmpdir(),
      `handoff-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );
    await fs.writeFile(filePath, content, 'utf-8');
    writtenFiles.push(filePath);
    return filePath;
  };

  it('resolves a valid full-mode file with the page in validPages and no issues', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        host: 'cake.me',
        pages: [
          {
            sourceUrl: 'https://www.cake.me/jobs/...?page=1',
            pageIndex: 1,
            totalPages: 3,
            captureMode: 'full',
            rawResponse: {
              current_page: 1,
              total_pages: 3,
              total_entries: 45,
              per_page: 15,
              data: [
                {
                  path: 'abc123',
                  title: 'Backend Engineer',
                  page: { path: 'some-company' },
                },
              ],
            },
          },
        ],
      }),
    );

    const result = await loadHandoffFile(filePath);

    expect(result.issues).toHaveLength(0);
    expect(result.validPages).toHaveLength(1);
    expect(result.validPages[0].captureMode).toBe('full');
    expect(result.validPages[0].sourceUrl).toBe(
      'https://www.cake.me/jobs/...?page=1',
    );
    expect(result.file.host).toBe('cake.me');
  });

  it('resolves a valid degraded-mode file with all items retained and no issues', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        host: '104.com.tw',
        pages: [
          {
            sourceUrl: 'https://www.104.com.tw/jobs/search/...&page=2',
            pageIndex: 2,
            totalPages: 3,
            captureMode: 'degraded',
            minimalItems: [
              {
                url: 'https://www.104.com.tw/job/abcde',
                title: '後端工程師',
                location: '台北市信義區',
                companyName: '某某科技',
                companyLink: 'https://www.104.com.tw/company/xyz',
                tags: [],
              },
            ],
          },
        ],
      }),
    );

    const result = await loadHandoffFile(filePath);

    expect(result.issues).toHaveLength(0);
    expect(result.validPages).toHaveLength(1);
    expect(result.validPages[0].minimalItems).toHaveLength(1);
    expect(result.validPages[0].minimalItems?.[0].url).toBe(
      'https://www.104.com.tw/job/abcde',
    );
  });

  it('rejects the whole call when host is not a recognized value', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        host: 'unknown-host.com',
        pages: [],
      }),
    );

    await expect(loadHandoffFile(filePath)).rejects.toThrow();
  });

  it('rejects the whole call when pages is not an array', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        host: 'cake.me',
        pages: 'not-an-array',
      }),
    );

    await expect(loadHandoffFile(filePath)).rejects.toThrow();
  });

  it('rejects the whole call when the file content is not valid JSON', async () => {
    const filePath = await writeTempFile('{ this is not json ');

    await expect(loadHandoffFile(filePath)).rejects.toThrow();
  });

  it('records exactly one issue for an item missing location, keeps the rest of the page valid', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        host: '104.com.tw',
        pages: [
          {
            sourceUrl: 'https://www.104.com.tw/jobs/search/...&page=2',
            pageIndex: 2,
            totalPages: 3,
            captureMode: 'degraded',
            minimalItems: [
              {
                url: 'https://www.104.com.tw/job/valid-item',
                title: '後端工程師',
                location: '台北市信義區',
                companyName: '某某科技',
              },
              {
                url: 'https://www.104.com.tw/job/missing-location',
                title: '前端工程師',
                companyName: '某某科技',
              },
            ],
          },
        ],
      }),
    );

    const result = await loadHandoffFile(filePath);

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].pageIndex).toBe(2);
    expect(result.issues[0].itemIndex).toBe(1);
    expect(result.issues[0].reason).toBeTruthy();

    expect(result.validPages).toHaveLength(1);
    const validItems = result.validPages[0].minimalItems ?? [];
    expect(validItems).toHaveLength(1);
    expect(validItems[0].url).toBe('https://www.104.com.tw/job/valid-item');
  });

  it('excludes a page-level-malformed page while keeping the other valid page unaffected', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        host: '104.com.tw',
        pages: [
          {
            sourceUrl: 'https://www.104.com.tw/jobs/search/...&page=1',
            pageIndex: 1,
            totalPages: 2,
            captureMode: 'degraded',
            minimalItems: [
              {
                url: 'https://www.104.com.tw/job/ok-item',
                title: '後端工程師',
                location: '台北市信義區',
                companyName: '某某科技',
              },
            ],
          },
          {
            sourceUrl: 'https://www.104.com.tw/jobs/search/...&page=2',
            pageIndex: 2,
            totalPages: 2,
            captureMode: 'degraded',
            // minimalItems missing entirely -- page-level malformed for degraded mode
          },
        ],
      }),
    );

    const result = await loadHandoffFile(filePath);

    expect(result.validPages).toHaveLength(1);
    expect(result.validPages[0].pageIndex).toBe(1);

    const pageLevelIssues = result.issues.filter(
      issue => issue.itemIndex === undefined,
    );
    expect(pageLevelIssues).toHaveLength(1);
    expect(pageLevelIssues[0].pageIndex).toBe(2);
  });

  it('rejects a full-mode page missing rawResponse at the page level, without affecting other pages', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        host: 'cake.me',
        pages: [
          {
            sourceUrl: 'https://www.cake.me/jobs/...?page=1',
            pageIndex: 1,
            totalPages: 2,
            captureMode: 'full',
            // rawResponse missing entirely -- page-level malformed for full mode
          },
          {
            sourceUrl: 'https://www.cake.me/jobs/...?page=2',
            pageIndex: 2,
            totalPages: 2,
            captureMode: 'full',
            rawResponse: {
              current_page: 2,
              total_pages: 2,
              total_entries: 30,
              per_page: 15,
              data: [],
            },
          },
        ],
      }),
    );

    const result = await loadHandoffFile(filePath);

    expect(result.validPages).toHaveLength(1);
    expect(result.validPages[0].pageIndex).toBe(2);

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].pageIndex).toBe(1);
    expect(result.issues[0].itemIndex).toBeUndefined();
  });

  it('falls back to the page array position (not NaN) when the malformed page itself has no usable pageIndex', async () => {
    const filePath = await writeTempFile(
      JSON.stringify({
        host: 'cake.me',
        pages: [
          {
            sourceUrl: 'https://www.cake.me/jobs/...?page=5',
            pageIndex: 5,
            totalPages: 6,
            captureMode: 'full',
            rawResponse: {
              current_page: 5,
              total_pages: 6,
              total_entries: 90,
              per_page: 15,
              data: [],
            },
          },
          {
            sourceUrl: 'https://www.cake.me/jobs/...?page=6',
            // pageIndex missing entirely -- also page-level malformed
            totalPages: 6,
            captureMode: 'full',
            rawResponse: {
              current_page: 6,
              total_pages: 6,
              total_entries: 90,
              per_page: 15,
              data: [],
            },
          },
        ],
      }),
    );

    const result = await loadHandoffFile(filePath);

    expect(result.validPages).toHaveLength(1);
    expect(result.validPages[0].pageIndex).toBe(5);

    expect(result.issues).toHaveLength(1);
    // The malformed page is at array index 1 (the second entry in `pages`),
    // distinct from the first page's declared pageIndex of 5. Falling back
    // to NaN here would be undiagnosable/unlocatable, so the loader must use
    // the page's position in the array instead.
    expect(result.issues[0].pageIndex).toBe(1);
    expect(Number.isNaN(result.issues[0].pageIndex)).toBe(false);
    expect(result.issues[0].itemIndex).toBeUndefined();
    expect(result.issues[0].reason).toMatch(/pageIndex/);
  });
});
