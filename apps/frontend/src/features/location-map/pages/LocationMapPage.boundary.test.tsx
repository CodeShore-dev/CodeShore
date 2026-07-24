import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { getRegionColor } from '../utils/colorScale';

// Task 11.2 -- boundary/edge-case regression (requirements.md 2.2, 3.3, 4.3,
// 4.4, 1.3, 1.4, 7.2). A SEPARATE file from task 11.1's concurrently-added
// `LocationMapPage.e2e.test.tsx` (happy-path click-through), per this task's
// own boundary -- that file is not touched here.
//
// Same mocking boundary as `LocationMapPage.test.tsx`/`LocationMapPage.e2e
// .test.tsx`: only `../queries` (`useLocationGroupsQuery`/
// `useLocationTechStatsQuery`) and `../../keyword/queries` (`useTechsQuery`)
// are mocked -- every other piece (`RegionChoropleth`, `ViewModeToggle`,
// `RegionDetailPanel`, `RegionMapError`, real `taiwan-atlas` geometry, real
// `useRegionValueMaps`/`utils/regionId`) is the actual, already-committed
// code, so these tests exercise the full integration rather than
// re-verifying any single child component in isolation.
//
// Where a scenario is already fully exercised by an already-committed test
// at this exact integration level, this file does not re-type it verbatim
// -- see the inline notes on the "neutral tech view" and "load error/retry"
// cases below for what existing coverage they build on and why the
// additions here have genuinely new teeth rather than duplicating it.
const { useLocationGroupsQuery, useLocationTechStatsQuery } = vi.hoisted(() => ({
  useLocationGroupsQuery: vi.fn(),
  useLocationTechStatsQuery: vi.fn(),
}));

vi.mock('../queries', () => ({
  useLocationGroupsQuery,
  useLocationTechStatsQuery,
}));

const { useTechsQuery } = vi.hoisted(() => ({ useTechsQuery: vi.fn() }));

vi.mock('../../keyword/queries', () => ({
  useTechsQuery,
}));

import { useLocationMapStore } from '../locationMapStore';
import { LocationMapPage } from './LocationMapPage';

const TECHS = [{ tech: 'react', label: 'React', icon_slugs: null }];

interface TechStatsRow {
  location: string;
  tech: string;
  job_count: number;
}

/**
 * Builds a `useLocationTechStatsQuery` mock implementation that dispatches
 * on the `where` shape the same way `LocationMapPage.e2e.test.tsx` already
 * does (`tech.eq` for map colouring, `location.eq` for
 * `RegionDetailPanel`'s ranking), but always returns a well-formed
 * `{ data, isLoading, isError, refetch }` object for any `where` it doesn't
 * recognise -- so a test that only cares about one branch can't crash on an
 * unmocked destructure elsewhere on the page.
 */
function makeTechStatsMock(rows: TechStatsRow[]) {
  return vi.fn((where: Record<string, { eq?: string } | undefined> = {}) => {
    const techEq = where.tech?.eq;
    const locationEq = where.location?.eq;

    let data: TechStatsRow[] = [];
    if (techEq) {
      data = rows.filter(r => r.tech === techEq);
    } else if (locationEq) {
      data = rows
        .filter(r => r.location === locationEq)
        .sort((a, b) => b.job_count - a.job_count);
    }
    return { data, isLoading: false, isError: false, refetch: vi.fn() };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useLocationMapStore.getState().reset();
  useTechsQuery.mockReturnValue({ data: TECHS, isLoading: false });
});

describe('LocationMapPage boundary/edge-case regression (task 11.2)', () => {
  it('renders a zero-job county and a zero-job township as SVG paths, not omitted (Requirement 2.2, 3.3)', async () => {
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
    useLocationTechStatsQuery.mockImplementation(makeTechStatsMock([]));

    renderWithProviders(<LocationMapPage />, { route: '/location-map' });

    // County tier: 高雄市 has no entry anywhere in the mocked dataset -- its
    // county total is 0 -- yet it must still be a rendered path, at the
    // lightest colour step (Requirement 2.2). Unlike the already-committed
    // `LocationMapPage.test.tsx` test that only asserts a *count* of 19
    // paths (outlying islands excluded), this pins down one SPECIFIC
    // zero-job county's id and fill, so
    // a regression that silently dropped (rather than merely miscoloured)
    // one particular unmatched region would be caught here too.
    const zeroCounty = document.querySelector('path[data-region-id="高雄市"]');
    expect(zeroCounty).not.toBeNull();
    expect(zeroCounty?.getAttribute('fill')).toBe(getRegionColor(0, 160));

    // Drill into 台北市 (max township value there is 120, from 信義區).
    await user.click(document.querySelector('path[data-region-id="台北市"]')!);
    await waitFor(() => {
      expect(document.querySelectorAll('path')).toHaveLength(12);
    });

    // 台北市中正區 has no entry in the job-count dataset -- must still
    // render, at the lightest step (Requirement 3.3), same "never hide"
    // rule as above but exercised through the township tier's real data
    // flow (real `towns-10t` geometry + `useRegionValueMaps`'s county-only
    // aggregation + `LocationMapPage`'s own per-township values), NOT
        // `RegionChoropleth.test.tsx`'s hand-built `valueByRegionId` maps.
    const zeroTownship = document.querySelector(
      'path[data-region-id="台北市中正區"]',
    );
    expect(zeroTownship).not.toBeNull();
    expect(zeroTownship?.getAttribute('fill')).toBe(getRegionColor(0, 120));
  });

  it(
    'stays neutral in the 技術 view (not falling back to job-count colouring) even when the ' +
      'tech-stats query already holds cached data, and shows the guidance prompt (Requirement 4.3)',
    async () => {
      const user = userEvent.setup();
      // Job-count data has non-uniform totals, so if the neutral guard were
      // ever dropped, counties would visibly diverge in colour instead of
      // staying uniform.
      useLocationGroupsQuery.mockReturnValue({
        data: [
          { location: '台北市信義區', count: 120 },
          { location: '新北市板橋區', count: 80 },
        ],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      // Deliberately returns non-empty rows for EVERY call regardless of
      // `where`/`enabled` -- simulating a stale cached result from a
      // *previous* tech selection still sitting in the query cache while
      // `selectedTech` is currently `null`. The already-committed
      // `LocationMapPage.test.tsx` neutral-state test (and
      // `useRegionValueMaps.spec.tsx`'s equivalent hook-level case) both use
      // a mock that returns `data: []` here, so neither can distinguish
      // "the page correctly ignored the data" from "there was simply no
      // data to leak in the first place". This mock closes that gap at the
      // full-page level.
      useLocationTechStatsQuery.mockReturnValue({
        data: [{ location: '台北市信義區', tech: 'react', job_count: 999 }],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });

      renderWithProviders(<LocationMapPage />, { route: '/location-map' });

      await user.click(screen.getByRole('tab', { name: '技術' }));

      expect(useLocationMapStore.getState().selectedTech).toBeNull();
      expect(screen.getByText('請選擇一個技術')).toBeInTheDocument();

      const paths = Array.from(document.querySelectorAll('path'));
      expect(paths).toHaveLength(19);
      for (const path of paths) {
        // Every path uniform at the neutral lightest shade -- if the stale
        // 999-row had leaked into `valueByRegionId`, 台北市 would render at
        // `getRegionColor(999, 999)` (darkest) instead of matching every
        // other county here.
        expect(path.getAttribute('fill')).toBe(getRegionColor(0, 0));
      }
    },
  );

  it('once a technology is selected, a region with 0 jobs for that technology still renders at both the county and township tier (Requirement 4.4)', async () => {
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
    // Only 台北市信義區 has any 'react' rows -- every other county/township
    // (including 高雄市 and 台北市's own 大安區) has 0 jobs for this tech.
    useLocationTechStatsQuery.mockImplementation(
      makeTechStatsMock([{ location: '台北市信義區', tech: 'react', job_count: 30 }]),
    );

    renderWithProviders(<LocationMapPage />, { route: '/location-map' });

    await user.click(screen.getByRole('tab', { name: '技術' }));
    await user.click(document.querySelector('[data-tech="react"]')!);
    expect(useLocationMapStore.getState().selectedTech).toBe('react');

    // County tier: 高雄市 has 0 'react' jobs -- max county value is 30
    // (信義區's total folded up to 台北市), so 高雄市 must render at
    // getRegionColor(0, 30), never omitted.
    await waitFor(() => {
      const path = document.querySelector('path[data-region-id="高雄市"]');
      expect(path).not.toBeNull();
      expect(path?.getAttribute('fill')).toBe(getRegionColor(0, 30));
    });

    // Drill into 台北市, still in tech view.
    await user.click(document.querySelector('path[data-region-id="台北市"]')!);
    await waitFor(() => {
      expect(document.querySelectorAll('path')).toHaveLength(12);
    });

    // Township tier: 大安區 has 0 'react' jobs (only 信義區 has any) -- max
    // township value under this tech is 30 (信義區), so 大安區 must still
    // render, at getRegionColor(0, 30).
    const zeroTechTownship = document.querySelector(
      'path[data-region-id="台北市大安區"]',
    );
    expect(zeroTechTownship).not.toBeNull();
    expect(zeroTechTownship?.getAttribute('fill')).toBe(getRegionColor(0, 30));
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
    useLocationTechStatsQuery.mockImplementation(makeTechStatsMock([]));

    const { rerender } = renderWithProviders(<LocationMapPage />, {
      route: '/location-map',
    });

    expect(screen.getByRole('heading', { name: '地圖載入失敗' })).toBeInTheDocument();
    expect(document.querySelectorAll('path')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: '重試' }));
    // This half already matches the already-committed
    // `LocationMapPage.test.tsx` "shows RegionMapError with a working retry
    // on query error" test one-for-one, so it is intentionally kept short
    // here rather than re-elaborated -- see that file for the case this is
    // building on.
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
    // county+district pair and returns `null` -- constructed deliberately
    // to fail that regex, not just an arbitrary typo.
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
    useLocationTechStatsQuery.mockImplementation(
      makeTechStatsMock([
        { location: '台北市信義區', tech: 'react', job_count: 30 },
        { location: MALFORMED_LOCATION, tech: 'react', job_count: 88888 },
      ]),
    );

    renderWithProviders(<LocationMapPage />, { route: '/location-map' });

    // No phantom 20th region: rendering the malformed row didn't inject an
    // extra path, and doing so didn't throw.
    expect(document.querySelectorAll('path')).toHaveLength(19);
    expect(
      document.querySelector(`path[data-region-id="${MALFORMED_LOCATION}"]`),
    ).toBeNull();

    // 台北市's job-count total must be exactly 120 + 40 = 160, NOT inflated
    // by the malformed row's 99999.
    let taipei = document.querySelector('path[data-region-id="台北市"]');
    expect(taipei).not.toBeNull();
    expect(taipei?.getAttribute('fill')).toBe(getRegionColor(160, 160));
    expect(taipei?.getAttribute('aria-label')).toContain('160 筆職缺');

    // Same exclusion rule holds for the tech-filtered aggregate (task 7.2's
    // `techCountyValues`): 台北市's 'react' total is 30 (from 信義區 alone),
    // not inflated by the malformed row's 88888.
    await user.click(screen.getByRole('tab', { name: '技術' }));
    await user.click(document.querySelector('[data-tech="react"]')!);

    await waitFor(() => {
      taipei = document.querySelector('path[data-region-id="台北市"]');
      expect(taipei?.getAttribute('fill')).toBe(getRegionColor(30, 30));
    });

    // The RegionDetailPanel total (job-count based regardless of view
    // mode, per `LocationMapPage`'s own `panelTotalJobCount`) also reflects
    // the un-inflated 160 for 台北市 once selected -- not the malformed
    // row's 99999.
    await user.click(taipei!);
    const panel = await screen.findByRole('region', { name: '地區明細' });
    expect(within(panel).getByText('160')).toBeInTheDocument();
  });
});
