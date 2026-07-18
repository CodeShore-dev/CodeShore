/**
 * Field-agnostic, shallow change detection between a previously persisted
 * job's comparable fields and a freshly crawled subset of the same fields.
 *
 * This utility intentionally has no knowledge of `salary_manual` or any
 * other Supabase-specific exemption rules: callers are responsible for
 * omitting `salary` from both `previous` and `fresh` when that exemption
 * applies. It also does not compare derived fields such as
 * `min_salary`/`max_salary`/`salary_type` — it only operates on whatever
 * keys are literally present (non-`undefined`) on `fresh`.
 */
export interface ComparableJobFields {
  title?: string;
  description?: string;
  location?: string;
  salary?: string;
  closed?: boolean;
}

export function hasJobFieldsChanged(
  previous: ComparableJobFields,
  fresh: ComparableJobFields,
): boolean {
  return (Object.keys(fresh) as (keyof ComparableJobFields)[]).some((key) => {
    const freshValue = fresh[key];
    if (freshValue === undefined) {
      return false;
    }
    return previous[key] !== freshValue;
  });
}
