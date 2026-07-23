import { create } from 'zustand';

export type LocationMapViewMode = 'jobCount' | 'tech';

interface LocationMapState {
  selectedCounty: string | null;
  selectedDistrict: string | null;
  viewMode: LocationMapViewMode;
  selectedTech: string | null;
  setSelectedCounty: (v: string | null) => void;
  setSelectedDistrict: (v: string | null) => void;
  setViewMode: (v: LocationMapViewMode) => void;
  setSelectedTech: (v: string | null) => void;
  reset: () => void;
}

// location-map UI/drilldown state (task 3.2). Server data (job/tech counts
// per region) lives in TanStack Query (task 5.1), not here.
export const useLocationMapStore = create<LocationMapState>(set => ({
  selectedCounty: null,
  selectedDistrict: null,
  viewMode: 'jobCount',
  selectedTech: null,
  // Switching counties (or returning to the nationwide overview via `null`)
  // always clears `selectedDistrict` — drilling into a new county must not
  // leave a stale district selection from the previously selected county
  // (Requirements 3.1, 3.2).
  setSelectedCounty: v => set({ selectedCounty: v, selectedDistrict: null }),
  setSelectedDistrict: v => set({ selectedDistrict: v }),
  setViewMode: v => set({ viewMode: v }),
  setSelectedTech: v => set({ selectedTech: v }),
  reset: () =>
    set({
      selectedCounty: null,
      selectedDistrict: null,
      viewMode: 'jobCount',
      selectedTech: null,
    }),
}));
