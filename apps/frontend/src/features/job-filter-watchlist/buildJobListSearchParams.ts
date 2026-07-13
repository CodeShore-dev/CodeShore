import type { JobFilterSnapshot } from '@codeshore/shared-utils';

// Mirrors `apps/frontend/src/features/job/hooks/useJobUrlSync.ts`'s
// "state -> URL" effect (lines ~99-131): the same multiplier used there to
// convert a stored salary amount back into the raw number the URL's
// `salaryAmt` param carries.
function salaryMultiplier(type: 'month' | 'year' | ''): number {
  if (type === 'year') return 1_000_000;
  if (type === 'month') return 10_000;
  return 1;
}

// Builds the `/jobs` query string that reproduces `snapshot`'s filter
// conditions (design.md's JobFilterWatchlistPage, "查看" action: "沿用既有
// useJobUrlSync 的參數命名規則反向組出查詢字串"). Deliberately a small,
// standalone, pure re-implementation of `useJobUrlSync`'s param-naming and
// serialization rules -- not an import from or edit to that hook, which is
// out of this feature's boundary (design.md's Boundary Commitments: this
// spec does not own `features/job/**`'s existing filter files). Only the
// fields present on `JobFilterSnapshot` are serialized; `useJobUrlSync`'s
// other URL params (`page`, `jobId`, `tab`) are session/navigation state,
// not part of a followed filter combination, so they are intentionally
// omitted here.
export function buildJobListSearchParams(
  snapshot: JobFilterSnapshot,
): URLSearchParams {
  const params = new URLSearchParams();

  if (snapshot.selectedTags.length) {
    params.set('tags', snapshot.selectedTags.join(','));
  }
  if (snapshot.excludedTags.length) {
    params.set('notTags', snapshot.excludedTags.join(','));
  }
  if (snapshot.techOperator !== 'and') {
    params.set('op', snapshot.techOperator);
  }

  if (snapshot.salaryFilter !== 'none') {
    params.set('salary', snapshot.salaryFilter);
  }
  if (snapshot.salaryAmount.type) {
    params.set('salaryType', snapshot.salaryAmount.type);
  }
  const mult = salaryMultiplier(snapshot.salaryAmount.type);
  const rawAmt =
    snapshot.salaryAmount.amount !== null && mult
      ? snapshot.salaryAmount.amount / mult
      : null;
  if (rawAmt !== null) {
    params.set('salaryAmt', String(rawAmt));
  }

  if (snapshot.searchText) {
    params.set('search', snapshot.searchText);
  }

  if (snapshot.selectedLocations.length) {
    params.set('locations', snapshot.selectedLocations.join(','));
  }

  const includeNames = snapshot.companyFilters
    .filter(entry => entry.mode === 'include')
    .map(entry => entry.name);
  const excludeNames = snapshot.companyFilters
    .filter(entry => entry.mode === 'exclude')
    .map(entry => entry.name);
  if (includeNames.length) {
    params.set('companies', includeNames.join(','));
  }
  if (excludeNames.length) {
    params.set('notCompanies', excludeNames.join(','));
  }

  return params;
}
