import { beforeEach, describe, expect, it } from 'vitest';

import { useAdminStore } from './adminStore';

const reset = () =>
  useAdminStore.setState({
    salaryPage: 3,
    selectedDates: [],
    selectedLocationGroups: [],
    salaryThreshold: { monthCeil: 300000, yearCeil: 9999999 },
  });

describe('useAdminStore', () => {
  beforeEach(reset);

  it('resets the salary page when the threshold changes', () => {
    useAdminStore.getState().setSalaryThreshold(100000, 1200000);
    expect(useAdminStore.getState().salaryThreshold).toEqual({
      monthCeil: 100000,
      yearCeil: 1200000,
    });
    expect(useAdminStore.getState().salaryPage).toBe(1);
  });

  it('toggles individual dates', () => {
    const { toggleDate } = useAdminStore.getState();
    toggleDate('2026-06-01');
    toggleDate('2026-06-02');
    toggleDate('2026-06-01');
    expect(useAdminStore.getState().selectedDates).toEqual(['2026-06-02']);
  });

  it('select-all toggles between all and none', () => {
    const all = ['a', 'b', 'c'];
    useAdminStore.getState().toggleAllDates(all);
    expect(useAdminStore.getState().selectedDates).toEqual(all);
    useAdminStore.getState().toggleAllDates(all);
    expect(useAdminStore.getState().selectedDates).toEqual([]);
  });

  it('toggles location groups independently', () => {
    const { toggleLocationGroup } = useAdminStore.getState();
    toggleLocationGroup('台北');
    expect(useAdminStore.getState().selectedLocationGroups).toEqual(['台北']);
    toggleLocationGroup('台北');
    expect(useAdminStore.getState().selectedLocationGroups).toEqual([]);
  });
});
