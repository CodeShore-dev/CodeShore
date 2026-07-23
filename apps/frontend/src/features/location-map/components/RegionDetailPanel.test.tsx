import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useLocationTechStatsQuery, useLocationGroupsQuery } = vi.hoisted(() => ({
  useLocationTechStatsQuery: vi.fn(),
  useLocationGroupsQuery: vi.fn(),
}));

// `RegionDetailPanel` reuses the already-committed `useLocationTechStatsQuery`
// (`../queries`) for its Top-10 technology ranking (task 8.1, design.md
// "MvLocationTechService（Service Contract）" 呼叫端使用方式 -- 地區明細面板
// 一列), so this spec mocks at that boundary rather than the underlying
// `./service` HTTP call. `useLocationGroupsQuery` (also re-exported from
// `../queries`, task 5.1) is mocked the same way -- task 8.2's county-tier
// "查看此地區職缺" reads the full `/api/job/location` result set through it.
vi.mock('../queries', () => ({
  useLocationTechStatsQuery,
  useLocationGroupsQuery,
}));

const { useTechsQuery } = vi.hoisted(() => ({
  useTechsQuery: vi.fn(),
}));

// Tech id -> {label, icon_slugs} lookup reuses the shared technology catalog
// exactly as `ViewModeToggle.tsx` (a sibling component in this same feature)
// already does -- `mv_location_tech` rows only carry a bare `tech` id, so
// rendering the `TechRankingRow`-style icon+label per row needs this same
// catalog. Mocked at that boundary, matching `ViewModeToggle.test.tsx`.
vi.mock('../../keyword/queries', () => ({
  useTechsQuery,
}));

import { RegionDetailPanel, RegionDetailPanelProps } from './RegionDetailPanel';

function makeTechStat(
  location: string,
  tech: string,
  job_count: number,
) {
  return { location, tech, job_count };
}

const TECHS = [
  { tech: 'react', label: 'React', icon_slugs: null, count: 10 },
  { tech: 'vue', label: 'Vue', icon_slugs: null, count: 5 },
  { tech: 'typescript', label: 'TypeScript', icon_slugs: null, count: 8 },
];

// Task 8.2 adds `navigate('/jobs?' + new URLSearchParams({...}))` calls
// (mirroring `CompanyListPage.tsx`/`TechRankingRow.tsx`), so every render now
// needs a Router context (`useNavigate()` throws outside of one). This
// codebase's existing convention for asserting `navigate` results (see
// `useJobUrlSync.test.tsx`, `Analytics.test.tsx`, `ScrollManager.test.tsx`) is
// a real `MemoryRouter` plus a sibling component reading `useLocation()`,
// rather than mocking `useNavigate` -- no test in this repo mocks
// `react-router` directly, so this spec follows the same real-router pattern
// instead of introducing a new one.
function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}
    </div>
  );
}

function renderPanel(props: RegionDetailPanelProps) {
  return render(
    <MemoryRouter initialEntries={['/location-map']}>
      <RegionDetailPanel {...props} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function readNavigatedParams(): URLSearchParams | null {
  const text = screen.getByTestId('location').textContent ?? '';
  const [, search] = text.split('?');
  if (search === undefined) return null;
  return new URLSearchParams(search);
}

beforeEach(() => {
  vi.clearAllMocks();
  useTechsQuery.mockReturnValue({ data: TECHS, isLoading: false });
  useLocationGroupsQuery.mockReturnValue({ data: [], isLoading: false });
});

describe('RegionDetailPanel', () => {
  it('calls useLocationTechStatsQuery scoped to the region, Top-10, job_count desc', () => {
    useLocationTechStatsQuery.mockReturnValue({ data: [], isLoading: false });

    renderPanel({
      regionId: '台北市信義區',
      displayName: '台北市信義區',
      totalJobCount: 42,
      tier: 'district',
    });

    expect(useLocationTechStatsQuery).toHaveBeenCalledWith(
      { location: { eq: '台北市信義區' } },
      { from: 0, to: 9, orders: 'job_count:desc' },
    );
  });

  it("renders the region's total open-job count", () => {
    useLocationTechStatsQuery.mockReturnValue({ data: [], isLoading: false });

    renderPanel({
      regionId: '台北市信義區',
      displayName: '台北市信義區',
      totalJobCount: 42,
      tier: 'district',
    });

    expect(screen.getByText('台北市信義區')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders up to 10 tech rows sorted by job count descending when job count > 0', () => {
    const rows = [
      makeTechStat('台北市信義區', 'react', 30),
      makeTechStat('台北市信義區', 'typescript', 25),
      makeTechStat('台北市信義區', 'vue', 20),
      makeTechStat('台北市信義區', 'a', 19),
      makeTechStat('台北市信義區', 'b', 18),
      makeTechStat('台北市信義區', 'c', 17),
      makeTechStat('台北市信義區', 'd', 16),
      makeTechStat('台北市信義區', 'e', 15),
      makeTechStat('台北市信義區', 'f', 14),
      makeTechStat('台北市信義區', 'g', 13),
      // 11th row -- must NOT be rendered even though the mocked hook
      // returned it (defensive client-side cap, in addition to the
      // `to: 9` server-side limit already asserted above).
      makeTechStat('台北市信義區', 'eleventh', 12),
    ];
    useLocationTechStatsQuery.mockReturnValue({ data: rows, isLoading: false });

    renderPanel({
      regionId: '台北市信義區',
      displayName: '台北市信義區',
      totalJobCount: 200,
      tier: 'district',
    });

    const list = screen.getByRole('list');
    expect(list.querySelectorAll('li')).toHaveLength(10);

    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Vue')).toBeInTheDocument();
    expect(screen.queryByText(/eleventh/)).not.toBeInTheDocument();

    // Sorted job_count desc, as returned by the (mocked) query.
    const renderedTechs = [...list.querySelectorAll('li')].map(li =>
      li.getAttribute('data-tech'),
    );
    expect(renderedTechs).toEqual([
      'react',
      'typescript',
      'vue',
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
    ]);
  });

  it('falls back to the raw tech id when no matching tech metadata is found', () => {
    useLocationTechStatsQuery.mockReturnValue({
      data: [makeTechStat('台北市信義區', 'unknown-tech', 5)],
      isLoading: false,
    });

    renderPanel({
      regionId: '台北市信義區',
      displayName: '台北市信義區',
      totalJobCount: 5,
      tier: 'district',
    });

    expect(screen.getByText('unknown-tech')).toBeInTheDocument();
  });

  it('renders a no-data message and ZERO tech rows when the total job count is 0 (Requirement 5.3)', () => {
    // Even if the mocked hook somehow still returned rows, the tech ranking
    // list must be entirely absent -- not even an empty list -- once the
    // region's total open-job count is 0.
    useLocationTechStatsQuery.mockReturnValue({
      data: [makeTechStat('台北市信義區', 'react', 3)],
      isLoading: false,
    });

    renderPanel({
      regionId: '台北市信義區',
      displayName: '台北市信義區',
      totalJobCount: 0,
      tier: 'district',
    });

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByText('React')).not.toBeInTheDocument();
    expect(screen.getByText(/沒有開放中職缺/)).toBeInTheDocument();
  });

  // --- Task 8.2: 跳轉回職缺頁 (Requirements 6.1, 6.2, 6.3, 6.4, 7.4) ---

  it('county tier "查看此地區職缺" navigates with every location_group id under that county, comma-joined (Requirement 6.1)', async () => {
    useLocationTechStatsQuery.mockReturnValue({ data: [], isLoading: false });
    useLocationGroupsQuery.mockReturnValue({
      data: [
        { location: '台北市信義區', count: 10 },
        { location: '台北市大安區', count: 5 },
        // A different county's rows must NOT leak into 台北市's id list.
        { location: '新北市板橋區', count: 3 },
        // Malformed rows (groupByCounty excludes these, Requirement 7.2)
        // must not break or appear in the county's id list.
        { location: '信義區', count: 1 },
      ],
      isLoading: false,
    });
    const user = userEvent.setup();

    renderPanel({
      regionId: '台北市',
      displayName: '台北市',
      totalJobCount: 15,
      tier: 'county',
    });

    await user.click(screen.getByRole('button', { name: '查看此地區職缺' }));

    const text = screen.getByTestId('location').textContent ?? '';
    expect(text.startsWith('/jobs')).toBe(true);
    const params = readNavigatedParams();
    expect(params?.get('locations')).toBe('台北市信義區,台北市大安區');
    expect(params?.has('tags')).toBe(false);
  });

  it('district tier "查看此地區職缺" navigates with just that single location_group id (Requirement 6.2)', async () => {
    useLocationTechStatsQuery.mockReturnValue({ data: [], isLoading: false });
    const user = userEvent.setup();

    renderPanel({
      regionId: '台北市信義區',
      displayName: '台北市信義區',
      totalJobCount: 42,
      tier: 'district',
    });

    await user.click(screen.getByRole('button', { name: '查看此地區職缺' }));

    const text = screen.getByTestId('location').textContent ?? '';
    expect(text.startsWith('/jobs')).toBe(true);
    const params = readNavigatedParams();
    expect(params?.get('locations')).toBe('台北市信義區');
    expect(params?.has('tags')).toBe(false);
  });

  it('clicking a tech ranking row at district tier navigates with both locations and tags (Requirement 6.3)', async () => {
    useLocationTechStatsQuery.mockReturnValue({
      data: [makeTechStat('台北市信義區', 'react', 30)],
      isLoading: false,
    });
    const user = userEvent.setup();

    renderPanel({
      regionId: '台北市信義區',
      displayName: '台北市信義區',
      totalJobCount: 30,
      tier: 'district',
    });

    await user.click(screen.getByText('React'));

    const params = readNavigatedParams();
    expect(params?.get('locations')).toBe('台北市信義區');
    expect(params?.get('tags')).toBe('react');
  });

  it('clicking a tech ranking row at county tier navigates with the whole county location list and tags (Requirement 6.3)', async () => {
    useLocationTechStatsQuery.mockReturnValue({
      data: [makeTechStat('台北市', 'vue', 12)],
      isLoading: false,
    });
    useLocationGroupsQuery.mockReturnValue({
      data: [
        { location: '台北市信義區', count: 10 },
        { location: '台北市大安區', count: 5 },
      ],
      isLoading: false,
    });
    const user = userEvent.setup();

    renderPanel({
      regionId: '台北市',
      displayName: '台北市',
      totalJobCount: 15,
      tier: 'county',
    });

    await user.click(screen.getByText('Vue'));

    const params = readNavigatedParams();
    expect(params?.get('locations')).toBe('台北市信義區,台北市大安區');
    expect(params?.get('tags')).toBe('vue');
  });
});
