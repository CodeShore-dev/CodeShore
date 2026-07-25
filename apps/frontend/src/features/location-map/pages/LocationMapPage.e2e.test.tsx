import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { getRegionColor } from '../utils/colorScale';

// Task 11.1 -- end-to-end popup-driven drilldown-to-jobs-URL flow
// (requirements.md 3.1, 3.2, 5.1-5.9, 6.1-6.4, 7.4; design.md "系統流程 >
// 使用者互動流程：點選地區 -> popup -> 下鑽 / 跳轉" sequence diagram).
// Rewired in task 18.1: clicking a county no longer drills down immediately
// -- it opens `RegionSummaryPopup`, and only that popup's "查看鄉鎮市區分布"
// button actually drills in. The "技術" view-switch step this file used to
// exercise no longer exists (Requirement 4.1, 4.2) -- the technology angle
// now surfaces via the popup's tech-category ranking instead.
//
// This repo has no Playwright/e2e harness (confirmed during design), so this
// remains the equivalent integration test: it renders the ACTUAL,
// already-committed `LocationMapPage` tree (real `RegionChoropleth`,
// `RegionSummaryPopup` and its hooks, real `taiwan-atlas` geometry, real
// `react-router` navigation) and only mocks the same query-hook/HTTP
// boundary `LocationMapPage.test.tsx` already mocks (`../queries`'s
// `useLocationGroupsQuery`/`useLocationTechStatsQuery`/
// `useLocationSalaryStatsQuery` and `../../keyword/queries`'s
// `useTechsQuery`) -- no child component is mocked.
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

// --- Single sources of truth for mock data -------------------------------
//
// Requirement 7.4 / "統計數字口徑一致" check: the map's job-count coloring
// and the popup's tech-category ranking must both read from the SAME arrays
// defined once below, so the count asserted as "shown" in the popup and the
// id asserted in the final `navigate()` URL can never silently diverge from
// each other inside this test's own setup.

// 職缺數視角來源：`/api/job/location` (`useLocationGroupsQuery`, task 5.1/8.2).
const LOCATION_GROUPS = [
  { location: '台北市信義區', count: 120 },
  { location: '台北市大安區', count: 40 },
  { location: '新北市板橋區', count: 80 },
];

// 技術分類排行來源：`/api/job/location-tech`
// (`useLocationTechStatsQuery`/`useRegionTechCategoryRanking`, task 16.2).
const TECH_STATS_ROWS = [
  { location: '台北市信義區', tech: 'react', job_count: 30 },
  { location: '台北市信義區', tech: 'vue', job_count: 10 },
  { location: '台北市大安區', tech: 'react', job_count: 5 },
];

const TECHS = [
  { tech: 'react', label: 'React', icon_slugs: null, category: 'framework' },
  { tech: 'vue', label: 'Vue', icon_slugs: null, category: 'framework' },
];

const SELECTED_TECH = 'react';
const SELECTED_TOWNSHIP = '台北市信義區';
// Derived straight from TECH_STATS_ROWS -- NOT re-typed as a separate
// literal -- so a future edit to TECH_STATS_ROWS can't accidentally make the
// "shown" assertions below stop matching the "in the URL" assertions.
const EXPECTED_REACT_COUNT_AT_TOWNSHIP = TECH_STATS_ROWS.find(
  row => row.location === SELECTED_TOWNSHIP && row.tech === SELECTED_TECH,
)!.job_count;

function mockQueries() {
  useLocationGroupsQuery.mockReturnValue({
    data: LOCATION_GROUPS,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });

  useLocationTechStatsQuery.mockImplementation(
    (where: Record<string, { eq?: string } | undefined> = {}) => {
      const locationEq = where.location?.eq;

      // `useRegionTechCategoryRanking`'s district-tier call filters by
      // `location.eq`; its county-tier call passes `{}` and aggregates the
      // full result set itself via `groupByCounty` (task 16.2) -- so the
      // "county" branch here must return every row, not just one location's.
      const data = locationEq
        ? TECH_STATS_ROWS.filter(row => row.location === locationEq)
        : TECH_STATS_ROWS;

      return { data, isLoading: false, isError: false };
    },
  );

  useLocationSalaryStatsQuery.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
  });

  useTechsQuery.mockReturnValue({ data: TECHS, isLoading: false });
}

// Same real-router pattern this file already used to assert `navigate()`
// results: a sibling component reads `useLocation()` so the final URL after
// `RegionSummaryPopup`'s `navigate('/jobs?' + ...)` call can be inspected.
function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location-probe">
      {location.pathname}
      {location.search}
    </div>
  );
}

function readNavigatedParams(): URLSearchParams | null {
  const text = screen.getByTestId('location-probe').textContent ?? '';
  const [, search] = text.split('?');
  if (search === undefined) return null;
  return new URLSearchParams(search);
}

beforeEach(() => {
  vi.clearAllMocks();
  useLocationMapStore.getState().reset();
  mockQueries();
});

describe('LocationMapPage end-to-end popup -> drilldown -> tech ranking -> jobs URL (task 11.1, rewired 18.1)', () => {
  it(
    'county click -> popup -> drilldown -> township click -> popup -> tech ranking row click ' +
      'navigates to /jobs with both the exact location and tag query params, with no technology ' +
      'view-switch path anywhere (Requirements 3.1, 3.2, 6.1-6.4, 7.4)',
    async () => {
      const user = userEvent.setup();

      // Step 1: page loads showing the 19-county job-count map (金門縣/
      // 連江縣/澎湖縣 excluded so the projection zooms into the main island).
      renderWithProviders(
        <>
          <LocationMapPage />
          <LocationProbe />
        </>,
        { route: '/location-map' },
      );

      expect(document.querySelectorAll('path')).toHaveLength(19);
      expect(screen.queryByRole('tab', { name: '職缺數' })).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: '技術' })).not.toBeInTheDocument();

      // Step 2: click a county -> opens its summary popup, map stays at the
      // county tier (Requirement 3.1). 台北市信義區(120) + 台北市大安區(40) =
      // 160.
      const countyPath = document.querySelector('path[data-region-id="台北市"]');
      expect(countyPath).not.toBeNull();
      await user.click(countyPath!);

      expect(useLocationMapStore.getState().openCountySummaryId).toBe('台北市');
      expect(useLocationMapStore.getState().selectedCounty).toBeNull();
      expect(document.querySelectorAll('path')).toHaveLength(19);
      expect(countyPath!.getAttribute('fill')).toBe(getRegionColor(160, 160));

      let modal = screen.getByTestId('modal-backdrop');
      expect(within(modal).getByRole('heading', { name: '台北市' })).toBeInTheDocument();
      expect(within(modal).getByText('160')).toBeInTheDocument();

      // Step 3: click "查看鄉鎮市區分布" inside the popup -> NOW it actually
      // drills down (Requirement 3.2), and the popup closes.
      await user.click(within(modal).getByRole('button', { name: '查看鄉鎮市區分布' }));

      expect(useLocationMapStore.getState().selectedCounty).toBe('台北市');
      expect(useLocationMapStore.getState().openCountySummaryId).toBeNull();
      await waitFor(() => {
        // 台北市 has 12 townships in the real taiwan-atlas fixture.
        expect(document.querySelectorAll('path')).toHaveLength(12);
      });
      expect(document.querySelector('path[data-region-id="台北市"]')).toBeNull();
      expect(screen.queryByTestId('modal-backdrop')).not.toBeInTheDocument();

      const townshipPath = document.querySelector(
        `path[data-region-id="${SELECTED_TOWNSHIP}"]`,
      );
      expect(townshipPath).not.toBeNull();
      // Job-count coloring at the township tier: 信義區 colored by the same
      // 120 later shown in its own popup -- same LOCATION_GROUPS source, no
      // divergence.
      expect(townshipPath!.getAttribute('fill')).toBe(getRegionColor(120, 120));

      // Step 4: click the township -> opens ITS OWN summary popup
      // (Requirement 5.1), showing its tech-category ranking (Requirement
      // 5.4) built from the SAME TECH_STATS_ROWS that will back the final
      // `navigate()` URL.
      await user.click(townshipPath!);
      expect(useLocationMapStore.getState().selectedDistrict).toBe(SELECTED_TOWNSHIP);

      modal = screen.getByTestId('modal-backdrop');
      expect(
        within(modal).getByRole('heading', { name: SELECTED_TOWNSHIP }),
      ).toBeInTheDocument();
      expect(within(modal).getByText('120')).toBeInTheDocument();
      // Leaf tier -- no further drilldown affordance.
      expect(
        within(modal).queryByRole('button', { name: '查看鄉鎮市區分布' }),
      ).not.toBeInTheDocument();

      const reactRow = within(modal).getByText('React').closest('li');
      expect(reactRow).not.toBeNull();
      expect(
        within(reactRow!).getByText(String(EXPECTED_REACT_COUNT_AT_TOWNSHIP)),
      ).toBeInTheDocument();

      // Step 5: click that technology row inside the popup's ranking.
      await user.click(within(modal).getByText('React'));

      // Step 6: final navigate() URL must contain both `locations` (the
      // selected township's location_group.id) and `tags` (the clicked
      // technology's id), comma-separated-list format --
      // `useJobUrlSync.ts` parses both via `.split(',')`.
      await waitFor(() => {
        const text = screen.getByTestId('location-probe').textContent ?? '';
        expect(text.startsWith('/jobs')).toBe(true);
      });
      const params = readNavigatedParams();
      expect(params?.get('locations')).toBe(SELECTED_TOWNSHIP);
      expect(params?.get('tags')).toBe(SELECTED_TECH);

      // Sanity check the exact format useJobUrlSync.ts expects to parse back
      // (comma-separated lists, even for single values).
      expect(params?.get('locations')?.split(',')).toEqual([SELECTED_TOWNSHIP]);
      expect(params?.get('tags')?.split(',')).toEqual([SELECTED_TECH]);
    },
  );
});
