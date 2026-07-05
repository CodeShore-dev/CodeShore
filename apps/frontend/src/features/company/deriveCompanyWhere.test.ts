import { describe, expect, it } from 'vitest';

import type { CompanyFilterEntry } from './companyFilterStore';
import {
  type CompanyWhereInput,
  deriveCompanyWhere,
} from './deriveCompanyWhere';

const base: CompanyWhereInput = {
  companyFilters: [],
  selectedTags: [],
  excludedTags: [],
  techOperator: 'and',
};

describe('deriveCompanyWhere', () => {
  it('returns an empty object with no filters', () => {
    expect(deriveCompanyWhere(base)).toEqual({});
  });

  it('builds a company_name in.(...) for include-only company filters', () => {
    const companyFilters: CompanyFilterEntry[] = [
      { name: 'Acme', mode: 'include' },
      { name: 'Globex', mode: 'include' },
    ];
    expect(deriveCompanyWhere({ ...base, companyFilters })).toEqual({
      company_name: { in: '(Acme,Globex)' },
    });
  });

  it('builds a company_name not.in(...) for exclude-only company filters', () => {
    const companyFilters: CompanyFilterEntry[] = [
      { name: 'Acme', mode: 'exclude' },
      { name: 'Globex', mode: 'exclude' },
    ];
    expect(deriveCompanyWhere({ ...base, companyFilters })).toEqual({
      company_name: { 'not.in': '(Acme,Globex)' },
    });
  });

  it('merges include and exclude company filters on the same column (both-present, AND semantics)', () => {
    const companyFilters: CompanyFilterEntry[] = [
      { name: 'Acme', mode: 'include' },
      { name: 'Globex', mode: 'exclude' },
    ];
    expect(deriveCompanyWhere({ ...base, companyFilters })).toEqual({
      company_name: { in: '(Acme)', 'not.in': '(Globex)' },
    });
  });

  it('omits company_name entirely when no company filters are present (neither-present)', () => {
    expect(deriveCompanyWhere({ ...base, companyFilters: [] })).toEqual({});
  });

  it('uses cs for AND-mode include-only technologies', () => {
    expect(
      deriveCompanyWhere({ ...base, selectedTags: ['a', 'b'] }),
    ).toEqual({ techs: { cs: '{a,b}' } });
  });

  it('uses ov for OR-mode include-only technologies', () => {
    expect(
      deriveCompanyWhere({
        ...base,
        selectedTags: ['a', 'b'],
        techOperator: 'or',
      }),
    ).toEqual({ techs: { ov: '{a,b}' } });
  });

  it('adds not.ov for exclude-only technologies', () => {
    expect(deriveCompanyWhere({ ...base, excludedTags: ['x'] })).toEqual({
      techs: { 'not.ov': '{x}' },
    });
  });

  it('combines include and exclude technology conditions', () => {
    expect(
      deriveCompanyWhere({
        ...base,
        selectedTags: ['a', 'b'],
        excludedTags: ['x'],
      }),
    ).toEqual({
      techs: { cs: '{a,b}', 'not.ov': '{x}' },
    });
  });

  it('omits techs entirely when no technology selection is present (neither-present)', () => {
    expect(
      deriveCompanyWhere({
        ...base,
        selectedTags: [],
        excludedTags: [],
      }),
    ).toEqual({});
  });
});
