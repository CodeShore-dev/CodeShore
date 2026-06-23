import { create } from 'zustand';

// Admin job-monitor UI state (task 9.1). Holds the *applied* query parameters
// (stats window, salary thresholds, unmapped-location max length, section pages)
// and the bulk-selection sets. Server data lives in TanStack Query; this store
// only carries inputs and selections (ported from the UI parts of useAdminStore).
interface AdminState {
  statsDays: number;
  salaryThreshold: { monthCeil: number; yearCeil: number };
  locationMaxLen: number;
  salaryPage: number;
  emptyPage: number;
  selectedDates: string[];
  selectedLocationGroups: string[];

  setStatsDays: (days: number) => void;
  setSalaryThreshold: (monthCeil: number, yearCeil: number) => void;
  setSalaryPage: (page: number) => void;
  setEmptyPage: (page: number) => void;

  toggleDate: (date: string) => void;
  toggleAllDates: (allDates: string[]) => void;
  setSelectedDates: (dates: string[]) => void;

  toggleLocationGroup: (key: string) => void;
  toggleAllLocationGroups: (allKeys: string[]) => void;
  setSelectedLocationGroups: (keys: string[]) => void;
}

const toggle = (list: string[], value: string): string[] =>
  list.includes(value)
    ? list.filter(x => x !== value)
    : [...list, value];

export const useAdminStore = create<AdminState>(set => ({
  statsDays: 7,
  salaryThreshold: { monthCeil: 300000, yearCeil: 9999999 },
  locationMaxLen: 30,
  salaryPage: 1,
  emptyPage: 1,
  selectedDates: [],
  selectedLocationGroups: [],

  // Changing the salary threshold resets to page 1 (parity with applySalaryThreshold).
  setStatsDays: days => set({ statsDays: days }),
  setSalaryThreshold: (monthCeil, yearCeil) =>
    set({ salaryThreshold: { monthCeil, yearCeil }, salaryPage: 1 }),
  setSalaryPage: page => set({ salaryPage: page }),
  setEmptyPage: page => set({ emptyPage: page }),

  toggleDate: date =>
    set(state => ({ selectedDates: toggle(state.selectedDates, date) })),
  toggleAllDates: allDates =>
    set(state => ({
      selectedDates:
        state.selectedDates.length === allDates.length ? [] : [...allDates],
    })),
  setSelectedDates: dates => set({ selectedDates: dates }),

  toggleLocationGroup: key =>
    set(state => ({
      selectedLocationGroups: toggle(state.selectedLocationGroups, key),
    })),
  toggleAllLocationGroups: allKeys =>
    set(state => ({
      selectedLocationGroups:
        state.selectedLocationGroups.length === allKeys.length
          ? []
          : [...allKeys],
    })),
  setSelectedLocationGroups: keys => set({ selectedLocationGroups: keys }),
}));
