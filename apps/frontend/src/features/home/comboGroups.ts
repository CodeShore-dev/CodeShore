import type { SupabaseView } from '@codeshore/data-types';

const COMBOS_PER_TECH = 5;

// 後端回傳的是所有組合的平 list（已依 job_count desc 排序），這裡按 tech1 分組，
// 每組只留前 COMBOS_PER_TECH 筆。組內順序沿用輸入順序。
export function groupTopCombosByTech(
  rows: SupabaseView.MvTechComboStats[],
): Map<string, SupabaseView.MvTechComboStats[]> {
  const groups = new Map<string, SupabaseView.MvTechComboStats[]>();
  for (const row of rows) {
    const group = groups.get(row.tech1) ?? [];
    if (group.length < COMBOS_PER_TECH) group.push(row);
    groups.set(row.tech1, group);
  }
  return groups;
}
