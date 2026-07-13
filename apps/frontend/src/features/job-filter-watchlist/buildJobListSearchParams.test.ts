import { describe, expect, it } from 'vitest';

import type { JobFilterSnapshot } from '@codeshore/shared-utils';

import { buildJobListSearchParams } from './buildJobListSearchParams';

function makeSnapshot(
  overrides: Partial<JobFilterSnapshot> = {},
): JobFilterSnapshot {
  return {
    searchText: '',
    companyFilters: [],
    salaryFilter: 'none',
    salaryAmount: { type: '', amount: null },
    selectedLocations: [],
    selectedTags: [],
    excludedTags: [],
    techOperator: 'and',
    ...overrides,
  };
}

// Pure snapshot -> /jobs query string builder (task 4.3), replicating
// useJobUrlSync.ts's "state -> URL" param naming/serialization rules
// (design.md's JobFilterWatchlistPage "查看" action).
describe('buildJobListSearchParams', () => {
  it('returns an empty URLSearchParams for a fully-empty snapshot', () => {
    const params = buildJobListSearchParams(makeSnapshot());

    expect(params.toString()).toBe('');
  });

  it('sets tags/notTags from selectedTags/excludedTags', () => {
    const params = buildJobListSearchParams(
      makeSnapshot({
        selectedTags: ['react', 'typescript'],
        excludedTags: ['php'],
      }),
    );

    expect(params.get('tags')).toBe('react,typescript');
    expect(params.get('notTags')).toBe('php');
  });

  it('sets op only when techOperator is not the "and" default', () => {
    expect(
      buildJobListSearchParams(makeSnapshot({ techOperator: 'and' })).get(
        'op',
      ),
    ).toBeNull();
    expect(
      buildJobListSearchParams(makeSnapshot({ techOperator: 'or' })).get(
        'op',
      ),
    ).toBe('or');
  });

  it('sets salary only when salaryFilter is not the "none" default', () => {
    expect(
      buildJobListSearchParams(makeSnapshot({ salaryFilter: 'none' })).get(
        'salary',
      ),
    ).toBeNull();
    expect(
      buildJobListSearchParams(
        makeSnapshot({ salaryFilter: 'excluding' }),
      ).get('salary'),
    ).toBe('excluding');
  });

  it('sets salaryType and divides salaryAmount.amount by the month multiplier (10,000)', () => {
    const params = buildJobListSearchParams(
      makeSnapshot({
        salaryFilter: 'only',
        salaryAmount: { type: 'month', amount: 600_000 },
      }),
    );

    expect(params.get('salaryType')).toBe('month');
    expect(params.get('salaryAmt')).toBe('60');
  });

  it('divides salaryAmount.amount by the year multiplier (1,000,000)', () => {
    const params = buildJobListSearchParams(
      makeSnapshot({
        salaryFilter: 'only',
        salaryAmount: { type: 'year', amount: 1_800_000 },
      }),
    );

    expect(params.get('salaryType')).toBe('year');
    expect(params.get('salaryAmt')).toBe('1.8');
  });

  it('omits salaryAmt when amount is null even if a type is set', () => {
    const params = buildJobListSearchParams(
      makeSnapshot({ salaryAmount: { type: 'month', amount: null } }),
    );

    expect(params.get('salaryType')).toBe('month');
    expect(params.has('salaryAmt')).toBe(false);
  });

  it('sets search from searchText when non-empty', () => {
    expect(
      buildJobListSearchParams(makeSnapshot({ searchText: '' })).get(
        'search',
      ),
    ).toBeNull();
    expect(
      buildJobListSearchParams(makeSnapshot({ searchText: 'backend' })).get(
        'search',
      ),
    ).toBe('backend');
  });

  it('sets locations from selectedLocations', () => {
    const params = buildJobListSearchParams(
      makeSnapshot({ selectedLocations: ['taipei', 'hsinchu'] }),
    );

    expect(params.get('locations')).toBe('taipei,hsinchu');
  });

  it('splits companyFilters into companies (include) and notCompanies (exclude)', () => {
    const params = buildJobListSearchParams(
      makeSnapshot({
        companyFilters: [
          { name: 'Acme', mode: 'include' },
          { name: 'Globex', mode: 'exclude' },
          { name: 'Initech', mode: 'include' },
        ],
      }),
    );

    expect(params.get('companies')).toBe('Acme,Initech');
    expect(params.get('notCompanies')).toBe('Globex');
  });

  it('omits companies/notCompanies when no entries of that mode exist', () => {
    const params = buildJobListSearchParams(
      makeSnapshot({
        companyFilters: [{ name: 'Acme', mode: 'include' }],
      }),
    );

    expect(params.get('companies')).toBe('Acme');
    expect(params.has('notCompanies')).toBe(false);
  });

  it('combines multiple set fields into one query string', () => {
    const params = buildJobListSearchParams(
      makeSnapshot({
        searchText: 'backend',
        companyFilters: [{ name: 'A公司', mode: 'exclude' }],
        salaryFilter: 'excluding',
        salaryAmount: { type: 'month', amount: 600_000 },
        selectedLocations: ['taipei'],
        selectedTags: ['react', 'typescript'],
        techOperator: 'and',
      }),
    );

    expect(params.get('tags')).toBe('react,typescript');
    expect(params.get('salary')).toBe('excluding');
    expect(params.get('salaryType')).toBe('month');
    expect(params.get('salaryAmt')).toBe('60');
    expect(params.get('search')).toBe('backend');
    expect(params.get('locations')).toBe('taipei');
    expect(params.get('notCompanies')).toBe('A公司');
    expect(params.has('op')).toBe(false);
    expect(params.has('companies')).toBe(false);
    expect(params.has('notTags')).toBe(false);
  });
});
