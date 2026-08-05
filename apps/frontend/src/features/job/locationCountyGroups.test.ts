import { describe, expect, it } from 'vitest';

import {
  groupJobLocationsByCounty,
  isBareCountyLocationId,
  jobLocationDistrictLabel,
  resolveJobLocationCounty,
} from './locationCountyGroups';

describe('isBareCountyLocationId', () => {
  it('matches a bare county/city string with no district', () => {
    expect(isBareCountyLocationId('台北市')).toBe(true);
    expect(isBareCountyLocationId('新竹縣')).toBe(true);
  });

  it('does not match a full county+district string', () => {
    expect(isBareCountyLocationId('台北市信義區')).toBe(false);
  });

  it('does not match an unparsable string', () => {
    expect(isBareCountyLocationId('legacy-unknown')).toBe(false);
  });
});

describe('resolveJobLocationCounty', () => {
  it('resolves a full county+district id to its county', () => {
    expect(resolveJobLocationCounty('台北市信義區')).toBe('台北市');
  });

  it('resolves a bare county id to itself', () => {
    expect(resolveJobLocationCounty('台北市')).toBe('台北市');
  });

  it('returns null for an unparsable id', () => {
    expect(resolveJobLocationCounty('信義區')).toBeNull();
  });
});

describe('groupJobLocationsByCounty', () => {
  it('groups a mix of district-level and bare county-level rows under the same county', () => {
    const grouped = groupJobLocationsByCounty([
      { location: '台北市信義區' },
      { location: '台北市' },
      { location: '台北市大安區' },
      { location: '新北市板橋區' },
    ]);

    expect(grouped.get('台北市')?.map(r => r.location)).toEqual([
      '台北市信義區',
      '台北市',
      '台北市大安區',
    ]);
    expect(grouped.get('新北市')?.map(r => r.location)).toEqual([
      '新北市板橋區',
    ]);
  });

  it('excludes rows that resolve to no county', () => {
    const grouped = groupJobLocationsByCounty([
      { location: 'legacy-unknown' },
      { location: '台北市信義區' },
    ]);

    expect(grouped.size).toBe(1);
    expect(grouped.get('台北市')).toHaveLength(1);
  });
});

describe('jobLocationDistrictLabel', () => {
  it('returns just the district part for a full county+district id', () => {
    expect(jobLocationDistrictLabel('台北市信義區')).toBe('信義區');
  });

  it('returns a distinct "未分區" label for a bare county-level id', () => {
    expect(jobLocationDistrictLabel('台北市')).toBe('未分區');
  });

  it('falls back to the raw id for an unparsable string', () => {
    expect(jobLocationDistrictLabel('legacy-unknown')).toBe('legacy-unknown');
  });
});
