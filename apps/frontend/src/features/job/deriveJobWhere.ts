import type { CompanyFilterEntry } from './jobFilterStore';

export interface JobWhereInput {
  searchText: string;
  companyFilters: CompanyFilterEntry[];
  salaryFilter: 'none' | 'excluding' | 'only';
  salaryAmount: { type: 'month' | 'year' | ''; amount: number | null };
  selectedLocations: string[];
  selectedTags: string[];
  excludedTags: string[];
  techOperator: 'and' | 'or';
}

const HAS_SALARY_WHERE = [
  'and(min_salary.neq.0,max_salary.eq.9999999)',
  'and(min_salary.eq.0,max_salary.neq.9999999)',
  'and(min_salary.neq.0,max_salary.neq.9999999)',
].join(', ');

// Pure port of useJobStore.baseFilters (task 7.1, requirements 3.1, 3.2).
// Builds the PostgREST-style `where` object from the job + keyword filter
// state. Kept pure so the filter logic is unit-testable.
export function deriveJobWhere(
  input: JobWhereInput,
): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const orGroups: string[] = [];

  if (input.searchText.trim()) {
    const q = input.searchText.trim();
    orGroups.push(`title.ilike.%${q}%,description.ilike.%${q}%`);
  }

  const includeNames = input.companyFilters
    .filter((entry) => entry.mode === 'include')
    .map((entry) => entry.name);
  const excludeNames = input.companyFilters
    .filter((entry) => entry.mode === 'exclude')
    .map((entry) => entry.name);

  const companyConditions: Record<string, string> = {};
  if (includeNames.length > 0) {
    companyConditions.in = `(${includeNames.join(',')})`;
  }
  if (excludeNames.length > 0) {
    companyConditions['not.in'] = `(${excludeNames.join(',')})`;
  }
  if (Object.keys(companyConditions).length > 0) {
    where.company_name = companyConditions;
  }

  const hasIncludeTags = input.selectedTags.length > 0;
  const hasExcludeTags = input.excludedTags.length > 0;
  if (hasIncludeTags || hasExcludeTags) {
    const conditions: Record<string, string> = {};
    if (hasIncludeTags) {
      const op = input.techOperator === 'or' ? 'ov' : 'cs';
      conditions[op] = `{${input.selectedTags.join(',')}}`;
    }
    if (hasExcludeTags) {
      conditions['not.ov'] = `{${input.excludedTags.join(',')}}`;
    }
    where.techs = conditions;
  }

  if (input.salaryFilter === 'excluding') {
    orGroups.push(HAS_SALARY_WHERE);
  } else if (input.salaryFilter === 'only') {
    orGroups.push('and(min_salary.eq.0,max_salary.eq.9999999)');
  }

  if (orGroups.length === 1) {
    where.$or = orGroups[0];
  } else if (orGroups.length > 1) {
    where.$or = orGroups;
  }

  if (input.salaryAmount.type) {
    where.salary_type = { eq: input.salaryAmount.type };
  }
  if (input.salaryAmount.amount !== null) {
    where.max_salary = { gte: input.salaryAmount.amount };
  }

  if (input.selectedLocations.length > 0) {
    where.location = { in: `(${input.selectedLocations.join(',')})` };
  }

  return where;
}
