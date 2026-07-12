import type { JobFilterSnapshot } from '@codeshore/shared-utils';

import { toWanInt } from '../../utils/format';

const SEPARATOR = '・';
const ALL_JOBS_LABEL = '所有職缺';

function resolveTechLabel(
  id: string,
  techLabelsById: Map<string, string>,
): string {
  return techLabelsById.get(id) ?? id;
}

function describeIncludedTech(
  snapshot: JobFilterSnapshot,
  techLabelsById: Map<string, string>,
): string | null {
  if (snapshot.selectedTags.length === 0) return null;
  const joiner = snapshot.techOperator === 'or' ? ' 或 ' : ', ';
  const labels = snapshot.selectedTags.map((id) =>
    resolveTechLabel(id, techLabelsById),
  );
  return `技術:${labels.join(joiner)}`;
}

function describeExcludedTech(
  snapshot: JobFilterSnapshot,
  techLabelsById: Map<string, string>,
): string | null {
  if (snapshot.excludedTags.length === 0) return null;
  const labels = snapshot.excludedTags.map((id) =>
    resolveTechLabel(id, techLabelsById),
  );
  return `排除技術:${labels.join(', ')}`;
}

function describeSalaryMode(snapshot: JobFilterSnapshot): string | null {
  if (snapshot.salaryFilter === 'excluding') return '只看有薪資職缺';
  if (snapshot.salaryFilter === 'only') return '只看未公開薪資職缺';
  return null;
}

function describeSalaryAmount(snapshot: JobFilterSnapshot): string | null {
  const { type, amount } = snapshot.salaryAmount;
  if (amount === null) return null;
  const prefix = type === 'month' ? '月薪' : type === 'year' ? '年薪' : '薪資';
  return `${prefix} ${toWanInt(amount)}萬+`;
}

function describeLocations(snapshot: JobFilterSnapshot): string | null {
  if (snapshot.selectedLocations.length === 0) return null;
  return `地點:${snapshot.selectedLocations.join(', ')}`;
}

function describeIncludedCompanies(
  snapshot: JobFilterSnapshot,
): string | null {
  const names = snapshot.companyFilters
    .filter((entry) => entry.mode === 'include')
    .map((entry) => entry.name);
  if (names.length === 0) return null;
  return `公司:${names.join(', ')}`;
}

function describeExcludedCompanies(
  snapshot: JobFilterSnapshot,
): string | null {
  const names = snapshot.companyFilters
    .filter((entry) => entry.mode === 'exclude')
    .map((entry) => entry.name);
  if (names.length === 0) return null;
  return `排除公司:${names.join(', ')}`;
}

/**
 * Turns a job filter snapshot into a human-readable summary of its active
 * conditions (tech include/exclude, salary mode + amount, locations,
 * company include/exclude), joined with the app's existing `・` separator.
 * Falls back to a fixed "all jobs" description when no condition is active.
 *
 * Pure function: does not fetch data. Tech ids are resolved to display
 * labels via the caller-supplied `techLabelsById` map; an id with no
 * matching label falls back to the raw id.
 */
export function describeFilterSnapshot(
  snapshot: JobFilterSnapshot,
  techLabelsById: Map<string, string>,
): string {
  const fragments = [
    describeIncludedTech(snapshot, techLabelsById),
    describeExcludedTech(snapshot, techLabelsById),
    describeSalaryMode(snapshot),
    describeSalaryAmount(snapshot),
    describeLocations(snapshot),
    describeIncludedCompanies(snapshot),
    describeExcludedCompanies(snapshot),
  ].filter((fragment): fragment is string => fragment !== null);

  if (fragments.length === 0) return ALL_JOBS_LABEL;

  return fragments.join(SEPARATOR);
}
