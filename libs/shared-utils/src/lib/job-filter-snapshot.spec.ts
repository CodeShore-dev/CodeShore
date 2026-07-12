import {
  normalizeFilterSnapshot,
  type JobFilterSnapshot,
} from './job-filter-snapshot';

function baseSnapshot(): JobFilterSnapshot {
  return {
    searchText: '  backend engineer  ',
    companyFilters: [
      { name: 'Beta Co', mode: 'exclude' },
      { name: 'Alpha Inc', mode: 'include' },
      { name: 'Alpha Inc', mode: 'exclude' },
    ],
    salaryFilter: 'only',
    salaryAmount: { type: 'month', amount: 60000 },
    selectedLocations: ['Taipei', 'Hsinchu'],
    selectedTags: ['TypeScript', 'React'],
    excludedTags: ['PHP', 'Java'],
    techOperator: 'and',
  };
}

describe('normalizeFilterSnapshot', () => {
  it('produces deep-equal results for two snapshots that differ only in array order', () => {
    const snapshotA: JobFilterSnapshot = {
      ...baseSnapshot(),
      companyFilters: [
        { name: 'Beta Co', mode: 'exclude' },
        { name: 'Alpha Inc', mode: 'include' },
        { name: 'Alpha Inc', mode: 'exclude' },
      ],
      selectedLocations: ['Taipei', 'Hsinchu'],
      selectedTags: ['TypeScript', 'React'],
      excludedTags: ['PHP', 'Java'],
    };

    const snapshotB: JobFilterSnapshot = {
      ...baseSnapshot(),
      companyFilters: [
        { name: 'Alpha Inc', mode: 'exclude' },
        { name: 'Alpha Inc', mode: 'include' },
        { name: 'Beta Co', mode: 'exclude' },
      ],
      selectedLocations: ['Hsinchu', 'Taipei'],
      selectedTags: ['React', 'TypeScript'],
      excludedTags: ['Java', 'PHP'],
    };

    expect(normalizeFilterSnapshot(snapshotA)).toEqual(
      normalizeFilterSnapshot(snapshotB),
    );
  });

  it('produces a different result for a genuinely different snapshot', () => {
    const snapshotA = baseSnapshot();
    const snapshotB: JobFilterSnapshot = {
      ...baseSnapshot(),
      selectedTags: ['Vue'],
    };

    expect(normalizeFilterSnapshot(snapshotA)).not.toEqual(
      normalizeFilterSnapshot(snapshotB),
    );
  });

  it('trims searchText and sorts companyFilters by name then mode', () => {
    const snapshot: JobFilterSnapshot = {
      ...baseSnapshot(),
      searchText: '  backend engineer  ',
      companyFilters: [
        { name: 'Alpha Inc', mode: 'include' },
        { name: 'Alpha Inc', mode: 'exclude' },
        { name: 'Beta Co', mode: 'exclude' },
      ],
    };

    const normalized = normalizeFilterSnapshot(snapshot);

    expect(normalized.searchText).toBe('backend engineer');
    expect(normalized.companyFilters).toEqual([
      { name: 'Alpha Inc', mode: 'exclude' },
      { name: 'Alpha Inc', mode: 'include' },
      { name: 'Beta Co', mode: 'exclude' },
    ]);
  });

  it('does not mutate the input snapshot and returns new array references', () => {
    const snapshot = baseSnapshot();
    const originalCompanyFilters = snapshot.companyFilters;
    const originalLocations = snapshot.selectedLocations;
    const originalTags = snapshot.selectedTags;
    const originalExcludedTags = snapshot.excludedTags;
    const snapshotCopy = JSON.parse(JSON.stringify(snapshot));

    const normalized = normalizeFilterSnapshot(snapshot);

    expect(snapshot).toEqual(snapshotCopy);
    expect(normalized.companyFilters).not.toBe(
      originalCompanyFilters,
    );
    expect(normalized.selectedLocations).not.toBe(
      originalLocations,
    );
    expect(normalized.selectedTags).not.toBe(originalTags);
    expect(normalized.excludedTags).not.toBe(
      originalExcludedTags,
    );
  });
});
