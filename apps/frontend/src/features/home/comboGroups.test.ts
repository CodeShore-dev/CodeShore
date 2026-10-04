import { describe, expect, it } from 'vitest';

import { groupTopCombosByTech } from './comboGroups';

function row(tech1: string, tech2: string, jobCount: number) {
  return { tech1, tech2, job_count: jobCount } as never;
}

describe('groupTopCombosByTech', () => {
  it('每個 tech1 最多保留 5 筆，且保留輸入順序（job_count desc）', () => {
    const rows = [
      row('java', 'a', 90),
      row('java', 'b', 80),
      row('java', 'c', 70),
      row('java', 'd', 60),
      row('java', 'e', 50),
      row('java', 'f', 40),
      row('java', 'g', 30),
    ];

    const groups = groupTopCombosByTech(rows);

    const java = groups.get('java') ?? [];
    expect(java).toHaveLength(5);
    expect(java.map(r => r.tech2)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('各 tech1 的組合互不混入', () => {
    const groups = groupTopCombosByTech([row('java', 'a', 90), row('react', 'b', 80), row('java', 'c', 70)]);

    expect(groups.get('java')?.map(r => r.tech2)).toEqual(['a', 'c']);
    expect(groups.get('react')?.map(r => r.tech2)).toEqual(['b']);
    expect(groups.has('go')).toBe(false);
  });
});
