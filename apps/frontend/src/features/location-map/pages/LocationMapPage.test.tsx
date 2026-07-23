import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { getRegionColor } from '../utils/colorScale';

const { useLocationGroupsQuery, useLocationTechStatsQuery } = vi.hoisted(() => ({
  useLocationGroupsQuery: vi.fn(),
  useLocationTechStatsQuery: vi.fn(),
}));

// `LocationMapPage` is the only place these already-committed pieces get
// wired together (task 9.1). Both `useRegionValueMaps` (task 6.2/7.2) and
// this page itself call `../queries`'s re-exported hooks, so mocking that one
// boundary covers every caller consistently -- matching how
// `useRegionValueMaps.spec.tsx`/`RegionDetailPanel.test.tsx` already mock it.
vi.mock('../queries', () => ({
  useLocationGroupsQuery,
  useLocationTechStatsQuery,
}));

const { useTechsQuery } = vi.hoisted(() => ({ useTechsQuery: vi.fn() }));

// `ViewModeToggle`/`RegionDetailPanel` both reuse the shared technology
// catalog via `useTechsQuery` (`../../keyword/queries`) -- mocked at the same
// boundary those components' own specs already use.
vi.mock('../../keyword/queries', () => ({
  useTechsQuery,
}));

import { useLocationMapStore } from '../locationMapStore';
import { LocationMapPage } from './LocationMapPage';

const LOCATION_GROUPS = [
  { location: '台北市信義區', count: 120 },
  { location: '台北市大安區', count: 40 },
  { location: '新北市板橋區', count: 80 },
];

function mockDefaultData() {
  useLocationGroupsQuery.mockReturnValue({
    data: LOCATION_GROUPS,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  useLocationTechStatsQuery.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  useTechsQuery.mockReturnValue({ data: [], isLoading: false });
}

beforeEach(() => {
  vi.clearAllMocks();
  useLocationMapStore.getState().reset();
  mockDefaultData();
});

describe('LocationMapPage (task 9.1)', () => {
  it('renders the county-tier map (22 paths) and defaults to the 職缺數 view on first render (Requirement 1.2)', () => {
    renderWithProviders(<LocationMapPage />, { route: '/location-map' });

    expect(document.querySelectorAll('path')).toHaveLength(22);
    expect(screen.getByRole('tab', { name: '職缺數' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(useLocationMapStore.getState().selectedCounty).toBeNull();
    expect(screen.queryByRole('region', { name: '地區明細' })).not.toBeInTheDocument();
  });

  it('colors 台北市 using the aggregated job-count total for that county', () => {
    renderWithProviders(<LocationMapPage />, { route: '/location-map' });

    const path = document.querySelector('path[data-region-id="台北市"]');
    expect(path).not.toBeNull();
    // 台北市信義區(120) + 台北市大安區(40) = 160, the dataset max.
    expect(path?.getAttribute('fill')).toBe(getRegionColor(160, 160));
  });

  it('shows RegionMapSkeleton while the map data is loading (Requirement 1.3)', () => {
    useLocationGroupsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<LocationMapPage />, { route: '/location-map' });

    expect(screen.getByTestId('region-map-skeleton')).toBeInTheDocument();
    expect(document.querySelectorAll('path')).toHaveLength(0);
  });

  it('shows RegionMapError with a working retry on query error (Requirement 1.4)', async () => {
    const refetch = vi.fn();
    useLocationGroupsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    });
    const user = userEvent.setup();

    renderWithProviders(<LocationMapPage />, { route: '/location-map' });

    expect(
      screen.getByRole('heading', { name: '地圖載入失敗' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '重試' }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('drilling into a county switches to the township tier and shows RegionDetailPanel for that county (Requirement 3.1, 5.1)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LocationMapPage />, { route: '/location-map' });

    const countyPath = document.querySelector('path[data-region-id="台北市"]');
    expect(countyPath).not.toBeNull();
    await user.click(countyPath!);

    expect(useLocationMapStore.getState().selectedCounty).toBe('台北市');
    // 台北市 has 12 townships in the real taiwan-atlas fixture.
    await waitFor(() => {
      expect(document.querySelectorAll('path')).toHaveLength(12);
    });
    expect(document.querySelector('path[data-region-id="台北市"]')).toBeNull();

    const panel = screen.getByRole('region', { name: '地區明細' });
    expect(panel).toHaveAttribute('data-region-id', '台北市');
    // Total job count shown is the whole county's aggregate, not a single
    // township's — comes from job-count data regardless of view mode.
    expect(screen.getByText('160')).toBeInTheDocument();
  });

  it('returning to the overview restores the 22-county tier and clears the detail panel (task 6.3 deferred affordance)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LocationMapPage />, { route: '/location-map' });

    await user.click(document.querySelector('path[data-region-id="台北市"]')!);
    await waitFor(() => {
      expect(document.querySelectorAll('path')).toHaveLength(12);
    });

    await user.click(screen.getByRole('button', { name: /返回全台總覽/ }));

    expect(useLocationMapStore.getState().selectedCounty).toBeNull();
    expect(useLocationMapStore.getState().selectedDistrict).toBeNull();
    await waitFor(() => {
      expect(document.querySelectorAll('path')).toHaveLength(22);
    });
    expect(screen.queryByRole('region', { name: '地區明細' })).not.toBeInTheDocument();
  });

  it('switching to the 技術 view without a selected tech shows the neutral prompt and colors every county the same lightest shade (Requirement 4.3)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LocationMapPage />, { route: '/location-map' });

    await user.click(screen.getByRole('tab', { name: '技術' }));

    expect(useLocationMapStore.getState().viewMode).toBe('tech');
    expect(useLocationMapStore.getState().selectedTech).toBeNull();
    expect(screen.getByText('請選擇一個技術')).toBeInTheDocument();

    const paths = Array.from(document.querySelectorAll('path'));
    expect(paths).toHaveLength(22);
    for (const path of paths) {
      expect(path.getAttribute('fill')).toBe(getRegionColor(0, 0));
    }
  });
});
