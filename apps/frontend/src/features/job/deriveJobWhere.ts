export interface JobWhereInput {
  searchText: string;
  companySearchText: string;
  salaryFilter: 'none' | 'excluding' | 'only';
  salaryAmount: { type: 'month' | 'year' | ''; amount: number | null };
  selectedLocations: string[];
  selectedTags: string[];
  excludedTags: string[];
  keywordOperator: 'and' | 'or';
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

  if (input.companySearchText.trim()) {
    where.company_name = { ilike: `%${input.companySearchText.trim()}%` };
  }

  const hasInclude = input.selectedTags.length > 0;
  const hasExclude = input.excludedTags.length > 0;
  if (hasInclude || hasExclude) {
    const conditions: Record<string, string> = {};
    if (hasInclude) {
      const op = input.keywordOperator === 'or' ? 'ov' : 'cs';
      conditions[op] = `{${input.selectedTags.join(',')}}`;
    }
    if (hasExclude) {
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
