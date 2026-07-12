export type CompanyFilterMode = 'include' | 'exclude';

export interface JobFilterSnapshotCompanyEntry {
  name: string;
  mode: CompanyFilterMode;
}

export interface JobFilterSnapshot {
  searchText: string;
  companyFilters: JobFilterSnapshotCompanyEntry[];
  salaryFilter: 'none' | 'excluding' | 'only';
  salaryAmount: {
    type: 'month' | 'year' | '';
    amount: number | null;
  };
  selectedLocations: string[];
  selectedTags: string[];
  excludedTags: string[];
  techOperator: 'and' | 'or';
}

function compareCompanyFilters(
  a: JobFilterSnapshotCompanyEntry,
  b: JobFilterSnapshotCompanyEntry,
): number {
  if (a.name !== b.name) {
    return a.name < b.name ? -1 : 1;
  }
  if (a.mode !== b.mode) {
    return a.mode < b.mode ? -1 : 1;
  }
  return 0;
}

/**
 * Normalizes a `JobFilterSnapshot` so that two snapshots with the same
 * semantic content but different array ordering become structurally
 * identical (deep-equal). Pure function: does not mutate `snapshot` and
 * does not share array references with it.
 */
export function normalizeFilterSnapshot(
  snapshot: JobFilterSnapshot,
): JobFilterSnapshot {
  return {
    ...snapshot,
    searchText: snapshot.searchText.trim(),
    companyFilters: [...snapshot.companyFilters]
      .map(entry => ({ ...entry }))
      .sort(compareCompanyFilters),
    salaryAmount: { ...snapshot.salaryAmount },
    selectedLocations: [...snapshot.selectedLocations].sort(),
    selectedTags: [...snapshot.selectedTags].sort(),
    excludedTags: [...snapshot.excludedTags].sort(),
  };
}
