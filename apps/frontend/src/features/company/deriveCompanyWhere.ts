import type { CompanyFilterEntry } from './companyFilterStore';

export interface CompanyWhereInput {
  companyFilters: CompanyFilterEntry[];
  selectedTags: string[];
  excludedTags: string[];
  techOperator: 'and' | 'or';
}

// Pure port of deriveJobWhere's company_name/techs condition-building logic
// (task 4.1, requirements 1.5, 1.6, 2.6, 2.7). Narrower than deriveJobWhere:
// only company name include/exclude and technology include/exclude/AND-OR,
// no search text, salary, or location.
export function deriveCompanyWhere(
  input: CompanyWhereInput,
): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  const includeNames = input.companyFilters
    .filter(entry => entry.mode === 'include')
    .map(entry => entry.name);
  const excludeNames = input.companyFilters
    .filter(entry => entry.mode === 'exclude')
    .map(entry => entry.name);

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

  return where;
}
