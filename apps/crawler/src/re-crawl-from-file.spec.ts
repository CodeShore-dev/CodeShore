import { describe, expect, it, vi } from 'vitest';

const { readFileMock } = vi.hoisted(() => ({
  readFileMock: vi.fn(),
}));

vi.mock('fs', () => ({
  promises: { readFile: readFileMock },
}));

import {
  buildJobIdWhere,
  parseJobIdCsv,
  readJobIdsFromCsvFile,
} from './re-crawl-from-file';

describe('parseJobIdCsv', () => {
  it('parses one job id per line', () => {
    expect(parseJobIdCsv('job-1\njob-2\njob-3')).toEqual([
      'job-1',
      'job-2',
      'job-3',
    ]);
  });

  it('skips a leading "id" header row (case-insensitive)', () => {
    expect(parseJobIdCsv('ID\njob-1\njob-2')).toEqual([
      'job-1',
      'job-2',
    ]);
  });

  it('does not treat "id" as a header when it is not the first data line', () => {
    expect(parseJobIdCsv('job-1\nid\njob-2')).toEqual([
      'job-1',
      'id',
      'job-2',
    ]);
  });

  it('ignores blank lines and surrounding whitespace/CRLF', () => {
    expect(parseJobIdCsv('\r\n  job-1  \r\n\r\njob-2\r\n\n')).toEqual([
      'job-1',
      'job-2',
    ]);
  });

  it('takes only the first column of each line and strips quotes', () => {
    expect(parseJobIdCsv('"job-1",104\njob-2,cake')).toEqual([
      'job-1',
      'job-2',
    ]);
  });

  it('deduplicates ids while preserving first-seen order', () => {
    expect(parseJobIdCsv('job-1\njob-2\njob-1')).toEqual([
      'job-1',
      'job-2',
    ]);
  });

  it('returns an empty array for empty content', () => {
    expect(parseJobIdCsv('')).toEqual([]);
  });
});

describe('readJobIdsFromCsvFile', () => {
  it('reads the file and returns parsed job ids', async () => {
    readFileMock.mockResolvedValueOnce('job-1\njob-2');

    await expect(
      readJobIdsFromCsvFile('/tmp/ids.csv'),
    ).resolves.toEqual(['job-1', 'job-2']);
    expect(readFileMock).toHaveBeenCalledWith('/tmp/ids.csv', 'utf-8');
  });

  it('throws a descriptive error when the file contains no job ids', async () => {
    readFileMock.mockResolvedValueOnce('id\n\n');

    await expect(
      readJobIdsFromCsvFile('/tmp/empty.csv'),
    ).rejects.toThrow(
      'Job id CSV file contains no job ids: /tmp/empty.csv',
    );
  });

  it('propagates the underlying file-read error (e.g. missing file)', async () => {
    readFileMock.mockRejectedValueOnce(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
    );

    await expect(
      readJobIdsFromCsvFile('/tmp/missing.csv'),
    ).rejects.toThrow('ENOENT');
  });
});

describe('buildJobIdWhere', () => {
  it('builds a PostgREST "in" where clause from job ids', () => {
    expect(buildJobIdWhere(['job-1', 'job-2'])).toEqual({
      id: { in: '(job-1,job-2)' },
    });
  });

  it('builds a well-formed clause for a single job id', () => {
    expect(buildJobIdWhere(['job-1'])).toEqual({
      id: { in: '(job-1)' },
    });
  });
});
