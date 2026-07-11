import { create } from 'zustand';

// Keyword-curation queue list UI state: current page and bulk-selection mode,
// mirroring `keyword/techStore.ts`'s established selectMode/selectedIds shape.
// Server data (the paginated queue) lives in TanStack Query
// (useKeywordQueueQuery); this store only holds the page number and the
// bulk-select toolbar's UI state.
interface QueueState {
  currentPage: number;
  selectMode: boolean;
  selectedIds: Set<string>;
  setPage: (page: number) => void;
  toggleSelectMode: () => void;
  toggleSelectId: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
}

export const useQueueStore = create<QueueState>(set => ({
  currentPage: 1,
  selectMode: false,
  selectedIds: new Set<string>(),
  setPage: page => set({ currentPage: page }),
  toggleSelectMode: () =>
    set(state => ({
      selectMode: !state.selectMode,
      // leaving select mode clears the current selection (parity with
      // techStore.ts's toggleSelectMode)
      selectedIds: state.selectMode ? new Set<string>() : state.selectedIds,
    })),
  toggleSelectId: id =>
    set(state => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),
  selectAll: ids => set({ selectedIds: new Set(ids) }),
  clearSelection: () => set({ selectedIds: new Set<string>() }),
}));
