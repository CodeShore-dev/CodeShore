import { describe, expect, it, vi } from 'vitest';

const { writeFileMock } = vi.hoisted(() => ({
  writeFileMock: vi.fn(),
}));

vi.mock('fs', () => ({
  promises: { writeFile: writeFileMock },
}));

const { jobPreferenceFetchAllMock } = vi.hoisted(() => ({
  jobPreferenceFetchAllMock: vi.fn(async () => ({
    result: [] as { job_id: string }[],
    count: 0,
    searchParams: '',
  })),
}));

vi.mock('@codeshore/data-utils', () => ({
  JobPreferenceService: vi.fn(() => ({
    fetchAll: jobPreferenceFetchAllMock,
  })),
}));

import {
  fetchJobIdsByUserPreference,
  toJobIdCsv,
  writeJobIdsCsv,
} from './export-preferenced-jobs';

describe('fetchJobIdsByUserPreference', () => {
  it('queries job_preference filtered by user_id and preference, defaulting to "like"', async () => {
    jobPreferenceFetchAllMock.mockResolvedValueOnce({
      result: [{ job_id: 'job-1' }, { job_id: 'job-2' }],
      count: 2,
      searchParams: '',
    });

    await expect(
      fetchJobIdsByUserPreference('user-1'),
    ).resolves.toEqual(['job-1', 'job-2']);

    expect(jobPreferenceFetchAllMock).toHaveBeenCalledWith({
      select: 'job_id',
      where: {
        user_id: { eq: 'user-1' },
        preference: { eq: 'like' },
      },
    });
  });

  it('forwards an explicit "dislike" preference', async () => {
    await fetchJobIdsByUserPreference('user-1', 'dislike');

    expect(jobPreferenceFetchAllMock).toHaveBeenCalledWith({
      select: 'job_id',
      where: {
        user_id: { eq: 'user-1' },
        preference: { eq: 'dislike' },
      },
    });
  });

  it('returns an empty array when the user has no matching preference rows', async () => {
    jobPreferenceFetchAllMock.mockResolvedValueOnce({
      result: [],
      count: 0,
      searchParams: '',
    });

    await expect(
      fetchJobIdsByUserPreference('user-1'),
    ).resolves.toEqual([]);
  });
});

describe('toJobIdCsv', () => {
  it('emits a "job_id" header followed by one id per line', () => {
    expect(toJobIdCsv(['job-1', 'job-2'])).toBe(
      'job_id\njob-1\njob-2\n',
    );
  });

  it('emits only the header when given no ids', () => {
    expect(toJobIdCsv([])).toBe('job_id\n');
  });
});

describe('writeJobIdsCsv', () => {
  it('writes the CSV content to the given path', async () => {
    await writeJobIdsCsv(['job-1', 'job-2'], '/tmp/liked.csv');

    expect(writeFileMock).toHaveBeenCalledWith(
      '/tmp/liked.csv',
      'job_id\njob-1\njob-2\n',
      'utf-8',
    );
  });
});
