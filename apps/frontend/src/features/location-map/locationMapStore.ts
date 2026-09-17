import { create } from 'zustand';

// `LocationMapViewMode` is kept as a standalone exported type (no longer a
// piece of store state -- see below) purely because `LocationMapHeader.tsx`
// (out of this task's boundary, task 18.1) still imports it for its own
// prop type. `LocationMapPage.tsx` now always passes it the literal
// `'jobCount'` (task 18.1 removes the "technology" view entirely per
// Requirement 4.1/4.2), so this alias only exists to avoid an unrelated
// compile break in a file this task isn't allowed to touch.
export type LocationMapViewMode = 'jobCount' | 'tech';

interface LocationMapState {
  selectedCounty: string | null;
  selectedDistrict: string | null;
  /**
   * 縣市層級目前開啟中的地區摘要 popup 對應的縣市（task 18.1，取代原本點選
   * 縣市即直接下鑽的行為，Requirement 3.1）。`null` 代表尚未開啟任何 popup。
   */
  openCountySummaryId: string | null;
  setSelectedCounty: (v: string | null) => void;
  setSelectedDistrict: (v: string | null) => void;
  setOpenCountySummaryId: (v: string | null) => void;
  reset: () => void;
}

// location-map UI/drilldown state (task 3.2). Server data (job/tech counts
// per region) lives in TanStack Query (task 5.1), not here.
export const useLocationMapStore = create<LocationMapState>(set => ({
  selectedCounty: null,
  selectedDistrict: null,
  openCountySummaryId: null,
  // Switching counties (or returning to the nationwide overview via `null`)
  // always clears `selectedDistrict` -- drilling into a new county must not
  // leave a stale district selection from the previously selected county
  // (Requirements 3.1, 3.2). It also always clears `openCountySummaryId`
  // (task 18.1): drilling into a county closes that county's summary popup
  // (design.md 系統流程: `setSelectedCounty` 並清空 `openCountySummaryId`),
  // and returning to the overview must not leave a stale popup open either.
  setSelectedCounty: v =>
    set({ selectedCounty: v, selectedDistrict: null, openCountySummaryId: null }),
  setSelectedDistrict: v => set({ selectedDistrict: v }),
  setOpenCountySummaryId: v => set({ openCountySummaryId: v }),
  reset: () =>
    set({
      selectedCounty: null,
      selectedDistrict: null,
      openCountySummaryId: null,
    }),
}));
