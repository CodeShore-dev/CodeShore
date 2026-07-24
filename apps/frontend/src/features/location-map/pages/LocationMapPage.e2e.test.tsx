import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { getRegionColor } from '../utils/colorScale';

// Task 11.1 -- end-to-end drilldown-to-jobs-URL flow (requirements.md 6.1-6.4,
// 7.4; design.md "系統流程 > 使用者互動流程：下鑽 + 技術跳轉" sequence
// diagram). design.md's own Testing Strategy row for this scenario reads:
// "E2E（沿用既有 Playwright/整合測試慣例，若專案已有等效機制）" -- this repo
// has no Playwright/e2e harness (confirmed during design), so this is the
// equivalent integration test: it renders the ACTUAL, already-committed
// `LocationMapPage` tree (real `RegionChoropleth`, `ViewModeToggle`,
// `RegionDetailPanel`, real `taiwan-atlas` geometry, real `react-router`
// navigation) and only mocks the same query-hook/HTTP boundary that
// `LocationMapPage.test.tsx` already mocks (`../queries`'s
// `useLocationGroupsQuery`/`useLocationTechStatsQuery` and
// `../../keyword/queries`'s `useTechsQuery`) -- no child component is mocked.
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

// --- Single sources of truth for mock data -------------------------------
//
// Requirement 7.4 / task 11.1's "統計數字口徑一致" check: the map's
// job-count view, the tech view's coloring, and RegionDetailPanel's Top-10
// ranking must all read from the SAME arrays defined once below, so the
// count asserted as "shown" on the map/panel and the ids asserted in the
// final `navigate()` URL can never silently diverge from each other inside
// this test's own setup.

// 職缺數視角 + 縣市層級「查看此地區職缺」展開來源：`/api/job/location`
// (`useLocationGroupsQuery`, task 5.1/8.2).
const LOCATION_GROUPS = [
  { location: '台北市信義區', count: 120 },
  { location: '台北市大安區', count: 40 },
  { location: '新北市板橋區', count: 80 },
];

// 技術視角來源：`/api/job/location-tech` (`useLocationTechStatsQuery`).
// Used BOTH by the map (filtered by `tech`, task 7.2/`useRegionValueMaps`+
// `LocationMapPage`'s own `techStatsQuery`) AND by `RegionDetailPanel`'s
// Top-10 ranking (filtered by `location`, task 8.1) -- same rows, two views.
const TECH_STATS_ROWS = [
  { location: '台北市信義區', tech: 'react', job_count: 30 },
  { location: '台北市信義區', tech: 'vue', job_count: 10 },
  { location: '台北市大安區', tech: 'react', job_count: 5 },
];

const TECHS = [
  { tech: 'react', label: 'React', icon_slugs: null },
  { tech: 'vue', label: 'Vue', icon_slugs: null },
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
    (where: Record<string, { eq?: string } | undefined>) => {
      const techEq = where.tech?.eq;
      const locationEq = where.location?.eq;

      let data: typeof TECH_STATS_ROWS = [];
      if (techEq) {
        // Map coloring: this technology's job_count across every location
        // (`useRegionValueMaps`'s techCountyValues + `LocationMapPage`'s own
        // per-township `townTechValues`, task 7.2).
        data = TECH_STATS_ROWS.filter(row => row.tech === techEq);
      } else if (locationEq) {
        // RegionDetailPanel's Top-10 ranking for one region (task 8.1),
        // server-side `orders: 'job_count:desc'` reproduced here.
        data = TECH_STATS_ROWS.filter(row => row.location === locationEq).sort(
          (a, b) => b.job_count - a.job_count,
        );
      }

      return { data, isLoading: false, isError: false, refetch: vi.fn() };
    },
  );

  useTechsQuery.mockReturnValue({ data: TECHS, isLoading: false });
}

// Same real-router pattern `RegionDetailPanel.test.tsx` already uses to
// assert `navigate()` results (this codebase's existing convention -- no
// spec mocks `react-router` directly): a sibling component reads
// `useLocation()` so the final URL after `RegionDetailPanel`'s
// `navigate('/jobs?' + ...)` call can be inspected.
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

describe('LocationMapPage end-to-end drilldown -> tech -> jobs URL (task 11.1)', () => {
  it(
    'county click -> township drilldown -> tech view -> tech selection -> ' +
      'township selection -> tech ranking row click navigates to /jobs with ' +
      'both the exact locations and tags query params (Requirements 6.1-6.4, 7.4)',
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
      expect(screen.getByRole('tab', { name: '職缺數' })).toHaveAttribute(
        'aria-selected',
        'true',
      );

      // Step 2: click a county -> drills down to that county's townships
      // (still job-count view). 台北市信義區(120) + 台北市大安區(40) = 160.
      const countyPath = document.querySelector('path[data-region-id="台北市"]');
      expect(countyPath).not.toBeNull();
      await user.click(countyPath!);

      expect(useLocationMapStore.getState().selectedCounty).toBe('台北市');
      await waitFor(() => {
        // 台北市 has 12 townships in the real taiwan-atlas fixture.
        expect(document.querySelectorAll('path')).toHaveLength(12);
      });
      expect(document.querySelector('path[data-region-id="台北市"]')).toBeNull();

      const townshipPath = document.querySelector(
        `path[data-region-id="${SELECTED_TOWNSHIP}"]`,
      );
      expect(townshipPath).not.toBeNull();

      // Still job-count view: 信義區 colored by the same 120 shown later in
      // the panel total -- same LOCATION_GROUPS source, no divergence.
      expect(townshipPath!.getAttribute('fill')).toBe(getRegionColor(120, 120));

      // Step 3: switch ViewModeToggle to "技術" (tech) view.
      await user.click(screen.getByRole('tab', { name: '技術' }));
      expect(useLocationMapStore.getState().viewMode).toBe('tech');
      expect(screen.getByText('請選擇一個技術')).toBeInTheDocument();

      // Step 4: select a specific technology from the list. At this point
      // RegionDetailPanel (still county-tier, showing 台北市) has no
      // `data-tech="react"` row of its own (no TECH_STATS_ROWS entry for the
      // bare county id '台北市'), so this selector is unambiguous.
      const techListEntry = document.querySelector(`[data-tech="${SELECTED_TECH}"]`);
      expect(techListEntry).not.toBeNull();
      await user.click(techListEntry!);

      expect(useLocationMapStore.getState().selectedTech).toBe(SELECTED_TECH);
      expect(screen.queryByText('請選擇一個技術')).not.toBeInTheDocument();

      // Tech view now colors 信義區 by the SAME TECH_STATS_ROWS row that will
      // later back the panel ranking row and the `tags` URL param.
      await waitFor(() => {
        const path = document.querySelector(
          `path[data-region-id="${SELECTED_TOWNSHIP}"]`,
        );
        expect(path?.getAttribute('aria-label')).toContain(
          `${EXPECTED_REACT_COUNT_AT_TOWNSHIP} 筆職缺`,
        );
        // Max across 台北市's townships under this tech is 30 (信義區) vs 5
        // (大安區) -> darkest step.
        expect(path?.getAttribute('fill')).toBe(
          getRegionColor(EXPECTED_REACT_COUNT_AT_TOWNSHIP, EXPECTED_REACT_COUNT_AT_TOWNSHIP),
        );
      });

      // Click the township region to select it (opens/updates
      // RegionDetailPanel at the 'district' tier for 信義區, per design.md's
      // sequence diagram: 點選某鄉鎮市區 -> setSelectedDistrict -> 顯示該地區
      // 明細).
      await user.click(
        document.querySelector(`path[data-region-id="${SELECTED_TOWNSHIP}"]`)!,
      );
      expect(useLocationMapStore.getState().selectedDistrict).toBe(SELECTED_TOWNSHIP);

      const panel = await screen.findByRole('region', { name: '地區明細' });
      expect(panel).toHaveAttribute('data-region-id', SELECTED_TOWNSHIP);
      // Total open-job count shown is always the job-count figure (120),
      // regardless of the current tech view mode -- same LOCATION_GROUPS
      // source as step 2's map coloring.
      expect(within(panel).getByText('120')).toBeInTheDocument();

      // Step 5: click a technology row inside RegionDetailPanel's ranking.
      // The ranking row shows the SAME job_count (30) that colored the map
      // in the previous step -- both read TECH_STATS_ROWS, so "shown" can't
      // have silently drifted from what's about to be asserted "in the URL".
      const reactRow = within(panel).getByText('React').closest('li');
      expect(reactRow).not.toBeNull();
      expect(within(reactRow!).getByText(String(EXPECTED_REACT_COUNT_AT_TOWNSHIP))).toBeInTheDocument();

      await user.click(within(panel).getByText('React'));

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
