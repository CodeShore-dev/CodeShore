import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { getRegionColor } from '../utils/colorScale';

const { useLocationGroupsQuery, useLocationTechStatsQuery, useLocationSalaryStatsQuery } =
  vi.hoisted(() => ({
    useLocationGroupsQuery: vi.fn(),
    useLocationTechStatsQuery: vi.fn(),
    useLocationSalaryStatsQuery: vi.fn(),
  }));

// `LocationMapPage` is the only place these already-committed pieces get
// wired together (task 9.1, rewired in task 18.1 to render
// `RegionSummaryPopup` instead of `ViewModeToggle`/`RegionDetailPanel`). Both
// `useRegionValueMaps` and this page itself call `../queries`'s re-exported
// `useLocationGroupsQuery`; `RegionSummaryPopup`'s own hooks
// (`useRegionSalaryStats`/`useRegionTechCategoryRanking`/
// `useRegionJobsNavigation`, not mocked here -- the real, already-committed
// implementations run) additionally call `useLocationTechStatsQuery` and
// `useLocationSalaryStatsQuery`, so this boundary now mocks all three.
vi.mock('../queries', () => ({
  useLocationGroupsQuery,
  useLocationTechStatsQuery,
  useLocationSalaryStatsQuery,
}));

const { useTechsQuery } = vi.hoisted(() => ({ useTechsQuery: vi.fn() }));

// `useRegionTechCategoryRanking` reuses the shared technology catalog via
// `useTechsQuery` (`../../keyword/queries`) -- mocked at the same boundary
// that component's own spec already uses.
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
  });
  useLocationSalaryStatsQuery.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
  });
  useTechsQuery.mockReturnValue({ data: [], isLoading: false });
}

beforeEach(() => {
  vi.clearAllMocks();
  useLocationMapStore.getState().reset();
  mockDefaultData();
});

describe('LocationMapPage (task 9.1, rewired in task 18.1)', () => {
  it('renders the county-tier map (19 mainland paths, outlying islands excluded) with no popup open initially (Requirement 1.2, 3.1)', () => {
    renderWithProviders(<LocationMapPage />, { route: '/location-map' });

    // 19, not the full 22 -- 金門縣/連江縣/澎湖縣 are deliberately excluded so
    // the projection zooms into the main island instead of shrinking to fit
    // those distant outlying counties.
    expect(document.querySelectorAll('path[data-region-id]')).toHaveLength(19);
    expect(document.querySelector('path[data-region-id="金門縣"]')).toBeNull();
    expect(document.querySelector('path[data-region-id="連江縣"]')).toBeNull();
    expect(document.querySelector('path[data-region-id="澎湖縣"]')).toBeNull();
    expect(useLocationMapStore.getState().selectedCounty).toBeNull();
    expect(useLocationMapStore.getState().openCountySummaryId).toBeNull();
    expect(screen.queryByTestId('modal-backdrop')).not.toBeInTheDocument();
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
    expect(document.querySelectorAll('path[data-region-id]')).toHaveLength(0);
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

  it('clicking a county opens its summary popup without drilling down, and the map stays at the county tier (Requirement 3.1)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LocationMapPage />, { route: '/location-map' });

    const countyPath = document.querySelector('path[data-region-id="台北市"]');
    expect(countyPath).not.toBeNull();
    await user.click(countyPath!);

    expect(useLocationMapStore.getState().openCountySummaryId).toBe('台北市');
    expect(useLocationMapStore.getState().selectedCounty).toBeNull();
    // Still the 19-county tier -- clicking a county no longer drills down
    // immediately.
    expect(document.querySelectorAll('path[data-region-id]')).toHaveLength(19);

    const modal = screen.getByTestId('modal-backdrop');
    expect(within(modal).getByRole('heading', { name: '台北市' })).toBeInTheDocument();
    // Total job count shown is the whole county's aggregate.
    expect(within(modal).getByText('160')).toBeInTheDocument();
  });

  it('clicking 進入鄉鎮市區分布 inside the open popup switches to the township tier and closes the popup (Requirement 3.2)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LocationMapPage />, { route: '/location-map' });

    await user.click(document.querySelector('path[data-region-id="台北市"]')!);
    expect(useLocationMapStore.getState().openCountySummaryId).toBe('台北市');

    await user.click(screen.getByRole('button', { name: '進入鄉鎮市區分布' }));

    expect(useLocationMapStore.getState().selectedCounty).toBe('台北市');
    expect(useLocationMapStore.getState().openCountySummaryId).toBeNull();
    // 台北市 has 12 townships in the real taiwan-atlas fixture.
    await waitFor(() => {
      expect(document.querySelectorAll('path[data-region-id]')).toHaveLength(12);
    });
    expect(document.querySelector('path[data-region-id="台北市"]')).toBeNull();
    // Drilling down must close the county popup -- nothing should linger.
    expect(screen.queryByTestId('modal-backdrop')).not.toBeInTheDocument();
  });

  it('clicking a township directly opens its own summary popup', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LocationMapPage />, { route: '/location-map' });

    await user.click(document.querySelector('path[data-region-id="台北市"]')!);
    await user.click(screen.getByRole('button', { name: '進入鄉鎮市區分布' }));
    await waitFor(() => {
      expect(document.querySelectorAll('path[data-region-id]')).toHaveLength(12);
    });

    const townshipPath = document.querySelector('path[data-region-id="台北市信義區"]');
    expect(townshipPath).not.toBeNull();
    await user.click(townshipPath!);

    expect(useLocationMapStore.getState().selectedDistrict).toBe('台北市信義區');

    const modal = screen.getByTestId('modal-backdrop');
    expect(
      within(modal).getByRole('heading', { name: '台北市信義區' }),
    ).toBeInTheDocument();
    // Total job count shown for a township is its own count (120), not the
    // whole county's.
    expect(within(modal).getByText('120')).toBeInTheDocument();
    // Township tier is a leaf -- no further drilldown affordance.
    expect(
      within(modal).queryByRole('button', { name: '進入鄉鎮市區分布' }),
    ).not.toBeInTheDocument();
  });

  it('no longer renders any 技術/職缺數 view-switching tab UI anywhere on the page (Requirement 4.1)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LocationMapPage />, { route: '/location-map' });

    expect(screen.queryByRole('tab', { name: '職缺數' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '技術' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();

    // Still true once a popup is open.
    await user.click(document.querySelector('path[data-region-id="台北市"]')!);
    expect(screen.queryByRole('tab', { name: '職缺數' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '技術' })).not.toBeInTheDocument();
  });

  it('returning to the overview restores the 19-county tier and closes any lingering popup (task 6.3 deferred affordance)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LocationMapPage />, { route: '/location-map' });

    await user.click(document.querySelector('path[data-region-id="台北市"]')!);
    await user.click(screen.getByRole('button', { name: '進入鄉鎮市區分布' }));
    await waitFor(() => {
      expect(document.querySelectorAll('path[data-region-id]')).toHaveLength(12);
    });
    // Open the township's popup too, so returning to the overview has
    // something to actually clear.
    await user.click(document.querySelector('path[data-region-id="台北市信義區"]')!);
    expect(screen.getByTestId('modal-backdrop')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /返回全台總覽/ }));

    expect(useLocationMapStore.getState().selectedCounty).toBeNull();
    expect(useLocationMapStore.getState().selectedDistrict).toBeNull();
    expect(useLocationMapStore.getState().openCountySummaryId).toBeNull();
    await waitFor(() => {
      expect(document.querySelectorAll('path[data-region-id]')).toHaveLength(19);
    });
    expect(screen.queryByTestId('modal-backdrop')).not.toBeInTheDocument();
  });

  it('shows the page title without the removed 「目前檢視」 badge (no more technology view, Requirement 4.1)', () => {
    renderWithProviders(<LocationMapPage />, { route: '/location-map' });

    expect(screen.getByRole('heading', { name: '職缺地圖' })).toBeInTheDocument();
    // 技術視角下線後地圖著色永遠依職缺數，「目前檢視」徽章已一併移除。
    expect(screen.queryByText(/目前檢視/)).not.toBeInTheDocument();
  });
});
