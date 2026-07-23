import { beforeEach, describe, expect, it } from 'vitest';

import { useLocationMapStore } from './locationMapStore';

beforeEach(() => {
  useLocationMapStore.getState().reset();
});

describe('locationMapStore', () => {
  it('has the expected default state (縣市層級 + 職缺數視角)', () => {
    expect(useLocationMapStore.getState()).toMatchObject({
      selectedCounty: null,
      selectedDistrict: null,
      viewMode: 'jobCount',
      selectedTech: null,
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

  it('setViewMode switches between jobCount and tech', () => {
    useLocationMapStore.getState().setViewMode('tech');
    expect(useLocationMapStore.getState().viewMode).toBe('tech');

    useLocationMapStore.getState().setViewMode('jobCount');
    expect(useLocationMapStore.getState().viewMode).toBe('jobCount');
  });

  it('setSelectedTech updates the selected tech', () => {
    useLocationMapStore.getState().setSelectedTech('react');
    expect(useLocationMapStore.getState().selectedTech).toBe('react');

    useLocationMapStore.getState().setSelectedTech(null);
    expect(useLocationMapStore.getState().selectedTech).toBeNull();
  });

  it('reset() restores all fields to their default values', () => {
    useLocationMapStore.getState().setSelectedCounty('台北市');
    useLocationMapStore.getState().setSelectedDistrict('信義區');
    useLocationMapStore.getState().setViewMode('tech');
    useLocationMapStore.getState().setSelectedTech('react');

    useLocationMapStore.getState().reset();

    expect(useLocationMapStore.getState()).toMatchObject({
      selectedCounty: null,
      selectedDistrict: null,
      viewMode: 'jobCount',
      selectedTech: null,
    });
  });
});
