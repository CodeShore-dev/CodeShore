import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { CATEGORY_LABEL_MAP } from '../../../utils/constants';
import { toWan } from '../../../utils/format';
import { getRegionColor } from '../utils/colorScale';

// Task 20.1 -- end-to-end popup-driven drilldown-to-jobs-URL flow
// (requirements.md 3.1, 3.2, 5.1, 5.2, 5.4, 6.1-6.4; design.md "系統流程 >
// 使用者互動流程：點選地區 -> popup -> 下鑽 / 跳轉" sequence diagram).
//
// This file previously covered task 11.1's ORIGINAL flow (before this
// round's popup/salary/tech-category changes) and was updated once during
// task 18.1's rewiring (popup-instead-of-direct-drilldown). That 18.1 update
// focused on 18.1's own acceptance criteria (popup opens instead of direct
// drill, drilldown only via the popup's button); it did NOT yet walk the
// FULL rich flow task 20.1 specifically requires -- salary display, >=2
// tech-category display, and a tech-row click all the way to the final
// `/jobs` URL assertion with real numbers backing every "shown" value. This
// rewrite extends the flow to cover all of that end to end.
//
// This repo has no Playwright/e2e harness (confirmed during design), so this
// remains the equivalent integration test: it renders the ACTUAL,
// already-committed `LocationMapPage` tree (real `RegionChoropleth`,
// `RegionSummaryPopup` and its hooks -- `useRegionSalaryStats`,
// `useRegionTechCategoryRanking`, `useRegionJobsNavigation` --, real
// `taiwan-atlas` geometry, real `react-router` navigation) and only mocks
// the same query-hook/HTTP boundary `LocationMapPage.test.tsx` already
// mocks (`../queries`'s `useLocationGroupsQuery`/`useLocationTechStatsQuery`/
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
// and the popup's salary/tech-category content must all read from the SAME
// arrays defined once below, so every "shown" assertion below is DERIVED
// from these fixtures rather than re-typed as an independent literal --
// a future edit to a fixture can't silently make a "shown" assertion stop
// matching what the popup / final URL actually produces.

// 職缺數視角來源：`/api/job/location` (`useLocationGroupsQuery`, task 5.1/8.2).
// 台北市信義區(120) + 台北市大安區(40) = 160 (台北市 county-level total).
const LOCATION_GROUPS = [
  { location: '台北市信義區', count: 120 },
  { location: '台北市大安區', count: 40 },
  { location: '新北市板橋區', count: 80 },
];

// 技術分類排行來源：`/api/job/location-tech`
// (`useLocationTechStatsQuery`/`useRegionTechCategoryRanking`, task 16.2).
// Spans 2 categories (react -> framework, typescript -> language) so the
// popup's `RegionTechCategoryList` renders more than one category section,
// both at the county tier (aggregated across 信義區+大安區) and at the
// district tier (信義區 alone).
const TECH_STATS_ROWS = [
  { location: '台北市信義區', tech: 'react', job_count: 30 },
  { location: '台北市信義區', tech: 'typescript', job_count: 25 },
  { location: '台北市大安區', tech: 'react', job_count: 5 },
];

const TECHS = [
  { tech: 'react', label: 'React', icon_slugs: null, category: 'framework' },
  { tech: 'typescript', label: 'TypeScript', icon_slugs: null, category: 'language' },
];

// 薪資概況來源：`/api/job/location-salary`
// (`useLocationSalaryStatsQuery`/`useRegionSalaryStats`, task 16.1). Covers
// both salary types (month/year) for both 台北市 townships, so the county
// popup exercises the weighted-average aggregation across townships and the
// township popup exercises the direct pass-through.
const SALARY_ROWS = [
  { location: '台北市信義區', salary_type: 'month', job_count: 80, avg_salary: 60000 },
  { location: '台北市信義區', salary_type: 'year', job_count: 40, avg_salary: 900000 },
  { location: '台北市大安區', salary_type: 'month', job_count: 30, avg_salary: 50000 },
  { location: '台北市大安區', salary_type: 'year', job_count: 10, avg_salary: 800000 },
];

const SELECTED_TECH = 'react';
const SELECTED_COUNTY = '台北市';
const SELECTED_TOWNSHIP = '台北市信義區';

// Derived straight from TECH_STATS_ROWS -- NOT re-typed as a separate
// literal -- so a future edit to TECH_STATS_ROWS can't accidentally make the
// "shown" assertions below stop matching the "in the URL" assertions.
const EXPECTED_REACT_COUNT_AT_TOWNSHIP = TECH_STATS_ROWS.find(
  row => row.location === SELECTED_TOWNSHIP && row.tech === SELECTED_TECH,
)!.job_count;

// Derived straight from SALARY_ROWS for the township popup (task 16.1's
// district-tier branch is a direct pass-through per salary type -- no
// aggregation math to reproduce here).
const DISTRICT_MONTH_ROW = SALARY_ROWS.find(
  row => row.location === SELECTED_TOWNSHIP && row.salary_type === 'month',
)!;
const DISTRICT_YEAR_ROW = SALARY_ROWS.find(
  row => row.location === SELECTED_TOWNSHIP && row.salary_type === 'year',
)!;

// Derived straight from SALARY_ROWS for the county popup, reproducing the
// documented (design.md) weighted-average formula
// `Σ(avg_salary × job_count) ÷ Σjob_count` that `useRegionSalaryStats`'s
// county-tier branch applies -- this is a spec'd public contract, not an
// internal implementation detail, so replicating it here to derive the
// expected display string is legitimate (same pattern as
// EXPECTED_REACT_COUNT_AT_TOWNSHIP above).
function weightedAvgSalary(rows: readonly { job_count: number; avg_salary: number }[]): number {
  const jobCount = rows.reduce((sum, row) => sum + row.job_count, 0);
  const weightedSum = rows.reduce((sum, row) => sum + row.avg_salary * row.job_count, 0);
  return weightedSum / jobCount;
}

const COUNTY_MONTH_ROWS = SALARY_ROWS.filter(row => row.salary_type === 'month');
const COUNTY_YEAR_ROWS = SALARY_ROWS.filter(row => row.salary_type === 'year');
const EXPECTED_COUNTY_MONTH_JOBCOUNT = COUNTY_MONTH_ROWS.reduce(
  (sum, row) => sum + row.job_count,
  0,
);
const EXPECTED_COUNTY_YEAR_JOBCOUNT = COUNTY_YEAR_ROWS.reduce(
  (sum, row) => sum + row.job_count,
  0,
);
const EXPECTED_COUNTY_MONTH_AVG_LABEL = toWan(weightedAvgSalary(COUNTY_MONTH_ROWS));
const EXPECTED_COUNTY_YEAR_AVG_LABEL = toWan(weightedAvgSalary(COUNTY_YEAR_ROWS));

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

  // `useRegionSalaryStats` always fetches the full unfiltered result set
  // (`useLocationSalaryStatsQuery({}, { from: 0, to: -1 })`) and filters
  // client-side by `tier`/`regionId` -- a single unconditional
  // `mockReturnValue` matches its actual call shape.
  useLocationSalaryStatsQuery.mockReturnValue({
    data: SALARY_ROWS,
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

// Requirement 4.1/4.2 check reused at multiple checkpoints throughout the
// flow (task 20.1's "全程不再出現「技術視角」切換路徑" acceptance criterion
// -- not just on first render, but also while popups are open).
function expectNoViewSwitchTabs() {
  expect(screen.queryByRole('tab', { name: '職缺數' })).not.toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: '技術' })).not.toBeInTheDocument();
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
}

beforeEach(() => {
  vi.clearAllMocks();
  useLocationMapStore.getState().reset();
  mockQueries();
});

describe('LocationMapPage end-to-end popup -> salary/tech ranking -> drilldown -> jobs URL (task 20.1)', () => {
  it(
    'county click -> popup with job count/salary/multi-category tech ranking -> drilldown -> ' +
      'township click -> popup with its own data -> tech ranking row click navigates to /jobs ' +
      'with both the exact location and tag query params, with no technology view-switch path ' +
      'anywhere (Requirements 3.1, 3.2, 5.1, 5.2, 5.4, 6.1-6.4)',
    async () => {
      const user = userEvent.setup();

      // Step 1: page loads showing the 19-county job-count map (金門縣/
      // 連江縣/澎湖縣 excluded so the projection zooms into the main island).
      // No view-switch tab UI anywhere on first render.
      renderWithProviders(
        <>
          <LocationMapPage />
          <LocationProbe />
        </>,
        { route: '/location-map' },
      );

      expect(document.querySelectorAll('path[data-region-id]')).toHaveLength(19);
      expectNoViewSwitchTabs();

      // Step 2: click a county -> opens its summary popup, map stays at the
      // county tier (Requirement 3.1).
      const countyPath = document.querySelector(`path[data-region-id="${SELECTED_COUNTY}"]`);
      expect(countyPath).not.toBeNull();
      await user.click(countyPath!);

      expect(useLocationMapStore.getState().openCountySummaryId).toBe(SELECTED_COUNTY);
      expect(useLocationMapStore.getState().selectedCounty).toBeNull();
      expect(document.querySelectorAll('path[data-region-id]')).toHaveLength(19);
      expect(countyPath!.getAttribute('fill')).toBe(getRegionColor(160, 160));

      let modal = screen.getByTestId('modal-backdrop');
      expect(within(modal).getByRole('heading', { name: SELECTED_COUNTY })).toBeInTheDocument();
      // Job count (Requirement 5.1): 台北市信義區(120) + 台北市大安區(40) = 160.
      expect(within(modal).getByText('160')).toBeInTheDocument();

      // Salary concourse (Requirement 5.2): month/year shown separately with
      // real, weighted-averaged numbers -- not merged into a single figure,
      // and not the "no data" placeholder.
      const countyMonthBlock = within(modal).getByText('月薪').closest('div');
      const countyYearBlock = within(modal).getByText('年薪').closest('div');
      expect(countyMonthBlock).not.toBeNull();
      expect(countyYearBlock).not.toBeNull();
      expect(
        within(countyMonthBlock!).getByText(String(EXPECTED_COUNTY_MONTH_JOBCOUNT)),
      ).toBeInTheDocument();
      expect(
        within(countyMonthBlock!).getByText(EXPECTED_COUNTY_MONTH_AVG_LABEL),
      ).toBeInTheDocument();
      expect(
        within(countyYearBlock!).getByText(String(EXPECTED_COUNTY_YEAR_JOBCOUNT)),
      ).toBeInTheDocument();
      expect(
        within(countyYearBlock!).getByText(EXPECTED_COUNTY_YEAR_AVG_LABEL),
      ).toBeInTheDocument();

      // Tech ranking split by >= 2 distinct categories (Requirement 5.4):
      // react -> 框架 (framework), typescript -> 語言 (language).
      expect(within(modal).getByText(CATEGORY_LABEL_MAP.framework)).toBeInTheDocument();
      expect(within(modal).getByText(CATEGORY_LABEL_MAP.language)).toBeInTheDocument();

      expectNoViewSwitchTabs();

      // Step 3: click "進入鄉鎮市區分布" inside the popup -> NOW it actually
      // drills down (Requirement 3.2), and the popup closes.
      await user.click(within(modal).getByRole('button', { name: '進入鄉鎮市區分布' }));

      expect(useLocationMapStore.getState().selectedCounty).toBe(SELECTED_COUNTY);
      expect(useLocationMapStore.getState().openCountySummaryId).toBeNull();
      await waitFor(() => {
        // 台北市 has 12 townships in the real taiwan-atlas fixture.
        expect(document.querySelectorAll('path[data-region-id]')).toHaveLength(12);
      });
      expect(document.querySelector(`path[data-region-id="${SELECTED_COUNTY}"]`)).toBeNull();
      expect(screen.queryByTestId('modal-backdrop')).not.toBeInTheDocument();

      const townshipPath = document.querySelector(
        `path[data-region-id="${SELECTED_TOWNSHIP}"]`,
      );
      expect(townshipPath).not.toBeNull();
      // Job-count coloring at the township tier: 信義區 colored by the same
      // 120 later shown in its own popup -- same LOCATION_GROUPS source, no
      // divergence.
      expect(townshipPath!.getAttribute('fill')).toBe(getRegionColor(120, 120));

      // Step 4: click the township -> opens ITS OWN summary popup directly,
      // with no intermediate step (Requirement 5.1), showing its own job
      // count/salary (Requirement 5.2)/tech-category ranking (Requirement
      // 5.4) -- all built from the SAME fixtures that will back the final
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
        within(modal).queryByRole('button', { name: '進入鄉鎮市區分布' }),
      ).not.toBeInTheDocument();

      const townshipMonthBlock = within(modal).getByText('月薪').closest('div');
      const townshipYearBlock = within(modal).getByText('年薪').closest('div');
      expect(townshipMonthBlock).not.toBeNull();
      expect(townshipYearBlock).not.toBeNull();
      expect(
        within(townshipMonthBlock!).getByText(String(DISTRICT_MONTH_ROW.job_count)),
      ).toBeInTheDocument();
      expect(
        within(townshipMonthBlock!).getByText(toWan(DISTRICT_MONTH_ROW.avg_salary)),
      ).toBeInTheDocument();
      expect(
        within(townshipYearBlock!).getByText(String(DISTRICT_YEAR_ROW.job_count)),
      ).toBeInTheDocument();
      expect(
        within(townshipYearBlock!).getByText(toWan(DISTRICT_YEAR_ROW.avg_salary)),
      ).toBeInTheDocument();

      expect(within(modal).getByText(CATEGORY_LABEL_MAP.framework)).toBeInTheDocument();
      expect(within(modal).getByText(CATEGORY_LABEL_MAP.language)).toBeInTheDocument();

      const reactRow = within(modal).getByText('React').closest('li');
      expect(reactRow).not.toBeNull();
      expect(
        within(reactRow!).getByText(String(EXPECTED_REACT_COUNT_AT_TOWNSHIP)),
      ).toBeInTheDocument();

      expectNoViewSwitchTabs();

      // Step 5: click that technology row inside the popup's ranking
      // (Requirement 6.3).
      await user.click(within(modal).getByText('React'));

      // Step 6: final navigate() URL must contain both `locations` (the
      // selected township's location_group.id) and `tags` (the clicked
      // technology's id), comma-separated-list format (Requirements 6.1-6.4)
      // -- `useJobUrlSync.ts` parses both via `.split(',')`.
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

      // Final check: no view-switch tab UI ever appeared, even after
      // navigating away (Requirement 4.1/4.2 -- the whole "技術視角" affordance
      // is gone, not just hidden while a popup happens to be open).
      expectNoViewSwitchTabs();
    },
  );
});
