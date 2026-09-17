import { describe, expect, it } from 'vitest';

import { deriveLocationChipGroups } from './deriveLocationChipGroups';

const ALL_TAIPEI = [
  { location: '台北市信義區' },
  { location: '台北市大安區' },
  { location: '台北市南港區' },
];

describe('deriveLocationChipGroups', () => {
  it('folds 2+ selected districts of the same county into one full-county group', () => {
    const groups = deriveLocationChipGroups(
      ['台北市信義區', '台北市大安區', '台北市南港區'],
      ALL_TAIPEI,
    );

    expect(groups).toEqual([
      {
        type: 'county',
        county: '台北市',
        districtIds: ['台北市信義區', '台北市大安區', '台北市南港區'],
        isFull: true,
      },
    ]);
  });

  it('marks a county group as partial when not every known district is selected', () => {
    const groups = deriveLocationChipGroups(
      ['台北市信義區', '台北市大安區'],
      ALL_TAIPEI,
    );

    expect(groups).toEqual([
      {
        type: 'county',
        county: '台北市',
        districtIds: ['台北市信義區', '台北市大安區'],
        isFull: false,
      },
    ]);
  });

  it('keeps a single selected district standalone instead of folding it into a one-item county group', () => {
    const groups = deriveLocationChipGroups(['台北市信義區'], ALL_TAIPEI);

    expect(groups).toEqual([
      { type: 'standalone', location: '台北市信義區' },
    ]);
  });

  it('folds a bare county-only selection (e.g. a "台北市" posting with no district) into its county group', () => {
    const groups = deriveLocationChipGroups(
      ['台北市', '台北市信義區', '台北市大安區'],
      [...ALL_TAIPEI, { location: '台北市' }],
    );

    expect(groups).toEqual([
      {
        type: 'county',
        county: '台北市',
        districtIds: ['台北市', '台北市信義區', '台北市大安區'],
        isFull: false,
      },
    ]);
  });

  it('counts the bare county row as part of the known total, so selecting it too yields isFull=true', () => {
    const groups = deriveLocationChipGroups(
      ['台北市', '台北市信義區', '台北市大安區', '台北市南港區'],
      [...ALL_TAIPEI, { location: '台北市' }],
    );

    expect(groups).toEqual([
      {
        type: 'county',
        county: '台北市',
        districtIds: [
          '台北市',
          '台北市信義區',
          '台北市大安區',
          '台北市南港區',
        ],
        isFull: true,
      },
    ]);
  });

  it('keeps a lone bare county selection standalone (below the 2-item fold threshold)', () => {
    const groups = deriveLocationChipGroups(
      ['台北市'],
      [...ALL_TAIPEI, { location: '台北市' }],
    );

    expect(groups).toEqual([{ type: 'standalone', location: '台北市' }]);
  });

  it('treats a truly unparsable location string as standalone', () => {
    const groups = deriveLocationChipGroups(
      ['legacy-unknown-location', '台北市信義區', '台北市大安區'],
      ALL_TAIPEI,
    );

    expect(groups).toEqual([
      {
        type: 'county',
        county: '台北市',
        districtIds: ['台北市信義區', '台北市大安區'],
        isFull: false,
      },
      { type: 'standalone', location: 'legacy-unknown-location' },
    ]);
  });

  it('defaults to isFull=true when the county is not present in locationGroups yet (data still loading)', () => {
    const groups = deriveLocationChipGroups(
      ['新竹市東區', '新竹市北區'],
      [],
    );

    expect(groups).toEqual([
      {
        type: 'county',
        county: '新竹市',
        districtIds: ['新竹市東區', '新竹市北區'],
        isFull: true,
      },
    ]);
  });

  it('groups multiple counties independently', () => {
    const groups = deriveLocationChipGroups(
      ['台北市信義區', '台北市大安區', '新北市板橋區', '新北市三重區'],
      [
        ...ALL_TAIPEI,
        { location: '新北市板橋區' },
        { location: '新北市三重區' },
        { location: '新北市新莊區' },
      ],
    );

    expect(groups).toEqual([
      {
        type: 'county',
        county: '台北市',
        districtIds: ['台北市信義區', '台北市大安區'],
        isFull: false,
      },
      {
        type: 'county',
        county: '新北市',
        districtIds: ['新北市板橋區', '新北市三重區'],
        isFull: false,
      },
    ]);
  });
});
