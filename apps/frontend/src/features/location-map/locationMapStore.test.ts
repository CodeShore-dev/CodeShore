import { beforeEach, describe, expect, it } from 'vitest';

import { useLocationMapStore } from './locationMapStore';

beforeEach(() => {
  useLocationMapStore.getState().reset();
});

describe('locationMapStore', () => {
  it('has the expected default state (縣市層級 + 無開啟中的地區摘要 popup)', () => {
    expect(useLocationMapStore.getState()).toMatchObject({
      selectedCounty: null,
      selectedDistrict: null,
      openCountySummaryId: null,
    });
  });

  it('setSelectedCounty clears a stale selectedDistrict from the previous county (req 3.1, 3.2)', () => {
    useLocationMapStore.getState().setSelectedCounty('台北市');
    useLocationMapStore.getState().setSelectedDistrict('信義區');
    expect(useLocationMapStore.getState()).toMatchObject({
      selectedCounty: '台北市',
      selectedDistrict: '信義區',
    });

    // Switching counties while drilled into a district must not leave a
    // stale district selection from the previous county.
    useLocationMapStore.getState().setSelectedCounty('新北市');
    expect(useLocationMapStore.getState().selectedCounty).toBe('新北市');
    expect(useLocationMapStore.getState().selectedDistrict).toBeNull();
  });

  it('setSelectedCounty(null) also clears selectedDistrict (返回全台總覽)', () => {
    useLocationMapStore.getState().setSelectedCounty('台北市');
    useLocationMapStore.getState().setSelectedDistrict('信義區');

    useLocationMapStore.getState().setSelectedCounty(null);
    expect(useLocationMapStore.getState().selectedCounty).toBeNull();
    expect(useLocationMapStore.getState().selectedDistrict).toBeNull();
  });

  it('setSelectedDistrict updates the district without touching the county', () => {
    useLocationMapStore.getState().setSelectedCounty('台北市');
    useLocationMapStore.getState().setSelectedDistrict('信義區');
    expect(useLocationMapStore.getState()).toMatchObject({
      selectedCounty: '台北市',
      selectedDistrict: '信義區',
    });
  });

  it('setOpenCountySummaryId updates which county summary popup is open', () => {
    useLocationMapStore.getState().setOpenCountySummaryId('台北市');
    expect(useLocationMapStore.getState().openCountySummaryId).toBe('台北市');

    useLocationMapStore.getState().setOpenCountySummaryId(null);
    expect(useLocationMapStore.getState().openCountySummaryId).toBeNull();
  });

  it('setSelectedCounty clears openCountySummaryId when drilling into a county (task 18.1)', () => {
    useLocationMapStore.getState().setOpenCountySummaryId('台北市');
    expect(useLocationMapStore.getState().openCountySummaryId).toBe('台北市');

    // Drilling down (following the popup's "進入鄉鎮市區分布" action) must
    // close whatever county-summary popup was open -- design.md 系統流程:
    // `onDrillDown` -> `setSelectedCounty` 並清空 `openCountySummaryId`.
    useLocationMapStore.getState().setSelectedCounty('台北市');
    expect(useLocationMapStore.getState().selectedCounty).toBe('台北市');
    expect(useLocationMapStore.getState().openCountySummaryId).toBeNull();
  });

  it('setSelectedCounty(null) also clears openCountySummaryId (返回全台總覽 closes any lingering popup)', () => {
    useLocationMapStore.getState().setSelectedCounty('台北市');
    useLocationMapStore.getState().setSelectedDistrict('信義區');
    useLocationMapStore.getState().setOpenCountySummaryId('新北市');

    useLocationMapStore.getState().setSelectedCounty(null);
    expect(useLocationMapStore.getState().selectedCounty).toBeNull();
    expect(useLocationMapStore.getState().selectedDistrict).toBeNull();
    expect(useLocationMapStore.getState().openCountySummaryId).toBeNull();
  });

  it('reset() restores all fields to their default values', () => {
    useLocationMapStore.getState().setSelectedCounty('台北市');
    useLocationMapStore.getState().setSelectedDistrict('信義區');
    useLocationMapStore.getState().setOpenCountySummaryId('新北市');

    useLocationMapStore.getState().reset();

    expect(useLocationMapStore.getState()).toMatchObject({
      selectedCounty: null,
      selectedDistrict: null,
      openCountySummaryId: null,
    });
  });
});
