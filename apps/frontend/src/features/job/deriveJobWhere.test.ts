import { describe, expect, it } from 'vitest';

import { type JobWhereInput, deriveJobWhere } from './deriveJobWhere';

const base: JobWhereInput = {
  searchText: '',
  companySearchText: '',
  salaryFilter: 'none',
  salaryAmount: { type: '', amount: null },
  selectedLocations: [],
  selectedTags: [],
  excludedTags: [],
  keywordOperator: 'and',
};

describe('deriveJobWhere', () => {
  it('returns an empty object with no filters', () => {
    expect(deriveJobWhere(base)).toEqual({});
  });

  it('builds a title/description search $or', () => {
    expect(deriveJobWhere({ ...base, searchText: 'go' })).toEqual({
      $or: 'title.ilike.%go%,description.ilike.%go%',
    });
  });

  it('builds a company_name ilike', () => {
    expect(
      deriveJobWhere({ ...base, companySearchText: 'acme' }),
    ).toEqual({ company_name: { ilike: '%acme%' } });
  });

  it('uses cs for AND and ov for OR on included tags', () => {
    expect(
      deriveJobWhere({ ...base, selectedTags: ['a', 'b'] }),
    ).toEqual({ keyword_groups: { cs: '{a,b}' } });
    expect(
      deriveJobWhere({
        ...base,
        selectedTags: ['a', 'b'],
        keywordOperator: 'or',
      }),
    ).toEqual({ keyword_groups: { ov: '{a,b}' } });
  });

  it('adds not.ov for excluded tags', () => {
    expect(deriveJobWhere({ ...base, excludedTags: ['x'] })).toEqual({
      keyword_groups: { 'not.ov': '{x}' },
    });
  });

  it('encodes salary "only" as a single $or string', () => {
    expect(deriveJobWhere({ ...base, salaryFilter: 'only' })).toEqual({
      $or: 'and(min_salary.eq.0,max_salary.eq.9999999)',
    });
  });

  it('combines multiple $or groups into an array', () => {
    const where = deriveJobWhere({
      ...base,
      searchText: 'go',
      salaryFilter: 'excluding',
    });
    expect(Array.isArray((where as { $or: unknown }).$or)).toBe(true);
    expect((where as { $or: string[] }).$or).toHaveLength(2);
  });

  it('adds salary_type, max_salary, and location filters', () => {
    expect(
      deriveJobWhere({
        ...base,
        salaryAmount: { type: 'year', amount: 1000000 },
        selectedLocations: ['台北', '新竹'],
      }),
    ).toEqual({
      salary_type: { eq: 'year' },
      max_salary: { gte: 1000000 },
      location: { in: '(台北,新竹)' },
    });
  });
});
