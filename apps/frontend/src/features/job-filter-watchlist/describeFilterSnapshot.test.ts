import { describe, expect, it } from 'vitest';

import type { JobFilterSnapshot } from '@codeshore/shared-utils';

import { describeFilterSnapshot } from './describeFilterSnapshot';

const base: JobFilterSnapshot = {
  searchText: '',
  companyFilters: [],
  salaryFilter: 'none',
  salaryAmount: { type: '', amount: null },
  selectedLocations: [],
  selectedTags: [],
  excludedTags: [],
  techOperator: 'and',
};

describe('describeFilterSnapshot', () => {
  it('returns the fixed "all jobs" fallback for a fully empty snapshot', () => {
    expect(describeFilterSnapshot(base, new Map())).toBe('所有職缺');
  });

  it('describes only the tech condition when only tech tags are set, falling back to the raw id when unmapped', () => {
    const snapshot: JobFilterSnapshot = {
      ...base,
      selectedTags: ['react', 'ts'],
      excludedTags: ['php'],
    };
    const techLabelsById = new Map([
      ['react', 'React'],
      ['ts', 'TypeScript'],
      // 'php' intentionally missing from the map to exercise the fallback.
    ]);

    expect(describeFilterSnapshot(snapshot, techLabelsById)).toBe(
      '技術:React, TypeScript・排除技術:php',
    );
  });

  it('describes tech with the "or" operator using a different joiner', () => {
    const snapshot: JobFilterSnapshot = {
      ...base,
      selectedTags: ['react', 'vue'],
      techOperator: 'or',
    };
    const techLabelsById = new Map([
      ['react', 'React'],
      ['vue', 'Vue'],
    ]);

    expect(describeFilterSnapshot(snapshot, techLabelsById)).toBe(
      '技術:React 或 Vue',
    );
  });

  it('describes only the salary condition when only salaryFilter is set', () => {
    const snapshot: JobFilterSnapshot = {
      ...base,
      salaryFilter: 'excluding',
    };

    expect(describeFilterSnapshot(snapshot, new Map())).toBe(
      '只看有薪資職缺',
    );
  });

  it('describes only the salary condition when only salaryFilter "only" is set', () => {
    const snapshot: JobFilterSnapshot = {
      ...base,
      salaryFilter: 'only',
    };

    expect(describeFilterSnapshot(snapshot, new Map())).toBe(
      '只看未公開薪資職缺',
    );
  });

  it('describes only the salary condition when only salaryAmount is set, using 萬 formatting', () => {
    const snapshot: JobFilterSnapshot = {
      ...base,
      salaryAmount: { type: 'month', amount: 60000 },
    };

    expect(describeFilterSnapshot(snapshot, new Map())).toBe('月薪 6萬+');
  });

  it('combines salary mode and salary amount when both are set', () => {
    const snapshot: JobFilterSnapshot = {
      ...base,
      salaryFilter: 'excluding',
      salaryAmount: { type: 'year', amount: 1000000 },
    };

    expect(describeFilterSnapshot(snapshot, new Map())).toBe(
      '只看有薪資職缺・年薪 100萬+',
    );
  });

  it('describes a mix of included and excluded companies distinctly', () => {
    const snapshot: JobFilterSnapshot = {
      ...base,
      companyFilters: [
        { name: 'Acme', mode: 'include' },
        { name: 'Globex', mode: 'include' },
        { name: 'Initech', mode: 'exclude' },
      ],
    };

    expect(describeFilterSnapshot(snapshot, new Map())).toBe(
      '公司:Acme, Globex・排除公司:Initech',
    );
  });

  it('describes the location condition', () => {
    const snapshot: JobFilterSnapshot = {
      ...base,
      selectedLocations: ['台北', '新竹'],
    };

    expect(describeFilterSnapshot(snapshot, new Map())).toBe(
      '地點:台北, 新竹',
    );
  });

  it('combines multiple active conditions in tech, salary, location, company order', () => {
    const snapshot: JobFilterSnapshot = {
      ...base,
      selectedTags: ['react', 'ts'],
      salaryAmount: { type: 'month', amount: 60000 },
      companyFilters: [{ name: 'A 公司', mode: 'exclude' }],
    };
    const techLabelsById = new Map([
      ['react', 'React'],
      ['ts', 'TypeScript'],
    ]);

    expect(describeFilterSnapshot(snapshot, techLabelsById)).toBe(
      '技術:React, TypeScript・月薪 6萬+・排除公司:A 公司',
    );
  });
});
