import { describe, expect, it } from 'vitest';

import {
  groupByCounty,
  normalizeCountyName,
  parseLocationGroupId,
  toRegionKey,
} from './regionId';

// Task 4.1 — pure helpers for matching taiwan-atlas geometry against
// `location_group.id` strings (requirements 3.1, 7.2). Valid/invalid id
// fixtures mirror the backend's `location-format-check.spec.ts` so both
// layers agree on what counts as a well-formed `location_group.id`.
describe('parseLocationGroupId', () => {
  it.each([
    ['台北市信義區', { county: '台北市', district: '信義區' }],
    ['新竹縣竹北市', { county: '新竹縣', district: '竹北市' }],
    ['高雄市苓雅區', { county: '高雄市', district: '苓雅區' }],
    ['南投縣埔里鎮', { county: '南投縣', district: '埔里鎮' }],
    ['嘉義縣布袋鄉', { county: '嘉義縣', district: '布袋鄉' }],
  ])('parses a well-formed 縣市+鄉鎮市區 id %s', (id, expected) => {
    expect(parseLocationGroupId(id)).toEqual(expected);
  });

  it.each([
    'taipei',
    'hsinchu',
    '信義區', // bare district, no county prefix
    '台北市', // county only, no district
    '台北市信義', // district missing its trailing 市/鎮/區/鄉
    'TaipeiXinyi',
    '',
  ])('returns null for a non-conforming id: %s', id => {
    expect(parseLocationGroupId(id)).toBeNull();
  });
});

describe('normalizeCountyName', () => {
  it.each([
    ['臺北市', '台北市'],
    ['臺中市', '台中市'],
    ['臺南市', '台南市'],
    ['臺東縣', '台東縣'],
  ])('normalizes the 臺→台 glyph for %s', (input, expected) => {
    expect(normalizeCountyName(input)).toBe(expected);
  });

  it.each(['台北市', '高雄市', '新竹縣', '南投縣'])(
    'leaves an already-台 or unaffected county name untouched: %s',
    name => {
      expect(normalizeCountyName(name)).toBe(name);
    },
  );

  it('does not touch counties/cities outside the four known 臺-glyph cases', () => {
    expect(normalizeCountyName('臺灣省')).toBe('臺灣省');
  });
});

describe('toRegionKey', () => {
  it('concatenates a normalized county with its district', () => {
    expect(toRegionKey('台北市', '信義區')).toBe('台北市信義區');
  });

  it('normalizes the 臺 glyph before concatenating', () => {
    expect(toRegionKey('臺北市', '信義區')).toBe('台北市信義區');
  });

  it('returns just the normalized county when no district is given', () => {
    expect(toRegionKey('臺中市')).toBe('台中市');
  });
});

describe('groupByCounty', () => {
  interface Row {
    location: string;
    job_count: number;
  }

  it('groups rows by the county parsed from `location`', () => {
    const rows: Row[] = [
      { location: '台北市信義區', job_count: 10 },
      { location: '台北市大安區', job_count: 5 },
      { location: '高雄市苓雅區', job_count: 3 },
    ];

    const grouped = groupByCounty(rows);

    expect(grouped.get('台北市')).toEqual([
      { location: '台北市信義區', job_count: 10 },
      { location: '台北市大安區', job_count: 5 },
    ]);
    expect(grouped.get('高雄市')).toEqual([
      { location: '高雄市苓雅區', job_count: 3 },
    ]);
    expect(grouped.size).toBe(2);
  });

  it('excludes rows whose `location` fails to parse instead of bucketing them as unknown', () => {
    const rows: Row[] = [
      { location: '台北市信義區', job_count: 10 },
      { location: '信義區', job_count: 99 }, // malformed: no county prefix
      { location: 'not-a-location', job_count: 1 },
    ];

    const grouped = groupByCounty(rows);

    expect(grouped.get('台北市')).toEqual([
      { location: '台北市信義區', job_count: 10 },
    ]);
    expect(grouped.size).toBe(1);
    expect(Array.from(grouped.values()).flat()).toHaveLength(1);
  });

  it('returns an empty map for an empty input', () => {
    expect(groupByCounty([]).size).toBe(0);
  });
});
