import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { getRegionColor } from '../utils/colorScale';

// Task 11.2 -- boundary/edge-case regression (requirements.md 2.2, 3.1, 3.2,
// 3.4, 1.3, 1.4, 5.8, 7.2). A SEPARATE file from task 11.1's concurrently-
// added `LocationMapPage.e2e.test.tsx` (happy-path click-through), per this
// task's own boundary -- that file is not touched here.
//
// Rewired in task 18.1: the "技術" view-switch scenarios this file used to
// cover (old Requirement 4.3/4.4) no longer apply -- that whole view was
// removed (Requirement 4.1, 4.2), so those two cases are gone rather than
// adapted. In their place this file now covers Requirement 5.8 (selecting a
// different region while a popup is open replaces its content) since that's
// a genuinely new edge case task 18.1 introduces.
//
// Same mocking boundary as `LocationMapPage.test.tsx`/`LocationMapPage.e2e
// .test.tsx`: only `../queries` (`useLocationGroupsQuery`/
// `useLocationTechStatsQuery`/`useLocationSalaryStatsQuery`) and
// `../../keyword/queries` (`useTechsQuery`) are mocked -- every other piece
// (`RegionChoropleth`, `RegionSummaryPopup` and its hooks, `RegionMapError`,
// real `taiwan-atlas` geometry, real `useRegionValueMaps`/`utils/regionId`)
// is the actual, already-committed code, so these tests exercise the full
// integration rather than re-verifying any single child component in
// isolation.
const { useLocationGroupsQuery, useLocationTechStatsQuery, useLocationSalaryStatsQuery } =
  vi.hoisted(() => ({
    useLocationGroupsQuery: vi.fn(),
    useLocationTechStatsQuery: vi.fn(),
    useLocationSalaryStatsQuery: vi.fn(),
  }));

vi.mock('../queries', () => ({
  useLocationGroupsQuery,
  useLocationTechStatsQuery,
  useLocationSalaryStatsQuery,
}));

const { useTechsQuery } = vi.hoisted(() => ({ useTechsQuery: vi.fn() }));

vi.mock('../../keyword/queries', () => ({
  useTechsQuery,
}));

import { useLocationMapStore } from '../locationMapStore';
import { LocationMapPage } from './LocationMapPage';

function mockEmptyPopupData() {
  useLocationTechStatsQuery.mockReturnValue({ data: [], isLoading: false, isError: false });
  useLocationSalaryStatsQuery.mockReturnValue({ data: [], isLoading: false, isError: false });
  useTechsQuery.mockReturnValue({ data: [], isLoading: false });
}

beforeEach(() => {
  vi.clearAllMocks();
  useLocationMapStore.getState().reset();
  mockEmptyPopupData();
});

describe('LocationMapPage boundary/edge-case regression (task 11.2, rewired 18.1)', () => {
  it('renders a zero-job county and a zero-job township as SVG paths, not omitted (Requirement 2.2, 3.4)', async () => {
    const user = userEvent.setup();
    useLocationGroupsQuery.mockReturnValue({
      data: [
        { location: '台北市信義區', count: 120 },
        { location: '台北市大安區', count: 40 },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<LocationMapPage />, { route: '/location-map' });

    // County tier: 高雄市 has no entry anywhere in the mocked dataset -- its
    // county total is 0 -- yet it must still be a rendered path, at the
    // lightest colour step (Requirement 2.2). Unlike
    // `LocationMapPage.test.tsx`'s test that only asserts a *count* of 19
    // paths (outlying islands excluded), this pins down one SPECIFIC
    // zero-job county's id and fill, so a regression that silently dropped
    // (rather than merely miscoloured) one particular unmatched region would
    // be caught here too.
    const zeroCounty = document.querySelector('path[data-region-id="高雄市"]');
    expect(zeroCounty).not.toBeNull();
    expect(zeroCounty?.getAttribute('fill')).toBe(getRegionColor(0, 160));

    // Drill into 台北市 via its popup's 查看鄉鎮市區分布 button (task 18.1:
    // clicking the county no longer drills down directly -- Requirement
    // 3.1/3.2). Max township value there is 120, from 信義區.
    await user.click(document.querySelector('path[data-region-id="台北市"]')!);
    await user.click(screen.getByRole('button', { name: '查看鄉鎮市區分布' }));
    await waitFor(() => {
      expect(document.querySelectorAll('path')).toHaveLength(12);
    });

    // 台北市中正區 has no entry in the job-count dataset -- must still
    // render, at the lightest step (Requirement 3.4), same "never hide" rule
    // as above but exercised through the township tier's real data flow
    // (real `towns-10t` geometry + `useRegionValueMaps`'s county-only
    // aggregation + `LocationMapPage`'s own per-township values), NOT
    // `RegionChoropleth.test.tsx`'s hand-built `valueByRegionId` maps.
    const zeroTownship = document.querySelector(
      'path[data-region-id="台北市中正區"]',
    );
    expect(zeroTownship).not.toBeNull();
    expect(zeroTownship?.getAttribute('fill')).toBe(getRegionColor(0, 120));
  });

  it('clicking a different county while one summary popup is open replaces it with the new county (Requirement 5.8)', async () => {
    const user = userEvent.setup();
    useLocationGroupsQuery.mockReturnValue({
      data: [
        { location: '台北市信義區', count: 120 },
        { location: '新北市板橋區', count: 80 },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<LocationMapPage />, { route: '/location-map' });

    await user.click(document.querySelector('path[data-region-id="台北市"]')!);
    expect(useLocationMapStore.getState().openCountySummaryId).toBe('台北市');
    let modal = screen.getByTestId('modal-backdrop');
    expect(within(modal).getByRole('heading', { name: '台北市' })).toBeInTheDocument();

    // Selecting another county while the popup is open replaces its content
    // rather than stacking a second popup or leaving stale content behind.
    await user.click(document.querySelector('path[data-region-id="新北市"]')!);

    expect(useLocationMapStore.getState().openCountySummaryId).toBe('新北市');
    expect(screen.getAllByTestId('modal-backdrop')).toHaveLength(1);
    modal = screen.getByTestId('modal-backdrop');
    expect(within(modal).getByRole('heading', { name: '新北市' })).toBeInTheDocument();
    expect(
      within(modal).queryByRole('heading', { name: '台北市' }),
    ).not.toBeInTheDocument();
  });

  it('shows RegionMapError on load failure, retry triggers refetch, and the map renders normally again once the query recovers (Requirement 1.3, 1.4)', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    useLocationGroupsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    });

    const { rerender } = renderWithProviders(<LocationMapPage />, {
      route: '/location-map',
    });

    expect(screen.getByRole('heading', { name: '地圖載入失敗' })).toBeInTheDocument();
    expect(document.querySelectorAll('path')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: '重試' }));
    // This half already matches `LocationMapPage.test.tsx`'s "shows
    // RegionMapError with a working retry on query error" test one-for-one,
    // so it is intentionally kept short here rather than re-elaborated -- see
    // that file for the case this is building on.
    expect(refetch).toHaveBeenCalledTimes(1);

    // What's genuinely new here: simulate the query actually recovering
    // afterwards and confirm the page reactively switches back to the real
    // map. A page that latched `isError`/`isLoading` into local state
    // instead of reading them fresh from the query on every render would
    // fail this half while still passing the "refetch was called" check
    // alone -- so this closes a gap the existing test leaves open.
    useLocationGroupsQuery.mockReturnValue({
      data: [{ location: '台北市信義區', count: 120 }],
      isLoading: false,
      isError: false,
      refetch,
    });
    rerender(<LocationMapPage />);

    expect(
      screen.queryByRole('heading', { name: '地圖載入失敗' }),
    ).not.toBeInTheDocument();
    expect(document.querySelectorAll('path')).toHaveLength(19);
  });

  it('excludes a location_group id in a non-conforming format from every county total, never surfaces it as its own region, and does not crash (Requirement 7.2)', async () => {
    const user = userEvent.setup();
    // '外太空基地' has no 市/縣 substring anywhere in it, so
    // `utils/regionId.ts`'s `parseLocationGroupId` (mirrored from the
    // backend's `LOCATION_GROUP_ID_PATTERN`) cannot split it into a
    // county+district pair and returns `null` -- constructed deliberately to
    // fail that regex, not just an arbitrary typo.
    const MALFORMED_LOCATION = '外太空基地';
    useLocationGroupsQuery.mockReturnValue({
      data: [
        { location: '台北市信義區', count: 120 },
        { location: '台北市大安區', count: 40 },
        { location: MALFORMED_LOCATION, count: 99999 },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<LocationMapPage />, { route: '/location-map' });

    // No phantom 20th region: rendering the malformed row didn't inject an
    // extra path, and doing so didn't throw.
    expect(document.querySelectorAll('path')).toHaveLength(19);
    expect(
      document.querySelector(`path[data-region-id="${MALFORMED_LOCATION}"]`),
    ).toBeNull();

    // 台北市's job-count total must be exactly 120 + 40 = 160, NOT inflated
    // by the malformed row's 99999.
    const taipei = document.querySelector('path[data-region-id="台北市"]');
    expect(taipei).not.toBeNull();
    expect(taipei?.getAttribute('fill')).toBe(getRegionColor(160, 160));
    expect(taipei?.getAttribute('aria-label')).toContain('160 筆職缺');

    // The popup's total job count (job-count based, per
    // `LocationMapPage`'s own `panelTotalJobCount`) also reflects the
    // un-inflated 160 for 台北市 once its summary is opened -- not the
    // malformed row's 99999.
    await user.click(taipei!);
    const modal = screen.getByTestId('modal-backdrop');
    expect(within(modal).getByText('160')).toBeInTheDocument();
  });
});
