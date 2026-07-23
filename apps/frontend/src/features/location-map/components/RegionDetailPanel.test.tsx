import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useLocationTechStatsQuery } = vi.hoisted(() => ({
  useLocationTechStatsQuery: vi.fn(),
}));

// `RegionDetailPanel` reuses the already-committed `useLocationTechStatsQuery`
// (`../queries`) for its Top-10 technology ranking (task 8.1, design.md
// "MvLocationTechService（Service Contract）" 呼叫端使用方式 -- 地區明細面板
// 一列), so this spec mocks at that boundary rather than the underlying
// `./service` HTTP call.
vi.mock('../queries', () => ({
  useLocationTechStatsQuery,
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

import { RegionDetailPanel } from './RegionDetailPanel';

function makeTechStat(tech: string, job_count: number) {
  return { location: '台北市信義區', tech, job_count };
}

const TECHS = [
  { tech: 'react', label: 'React', icon_slugs: null, count: 10 },
  { tech: 'vue', label: 'Vue', icon_slugs: null, count: 5 },
  { tech: 'typescript', label: 'TypeScript', icon_slugs: null, count: 8 },
];

beforeEach(() => {
  vi.clearAllMocks();
  useTechsQuery.mockReturnValue({ data: TECHS, isLoading: false });
});

describe('RegionDetailPanel', () => {
  it('calls useLocationTechStatsQuery scoped to the region, Top-10, job_count desc', () => {
    useLocationTechStatsQuery.mockReturnValue({ data: [], isLoading: false });

    render(
      <RegionDetailPanel
        regionId="台北市信義區"
        displayName="台北市信義區"
        totalJobCount={42}
      />,
    );

    expect(useLocationTechStatsQuery).toHaveBeenCalledWith(
      { location: { eq: '台北市信義區' } },
      { from: 0, to: 9, orders: 'job_count:desc' },
    );
  });

  it("renders the region's total open-job count", () => {
    useLocationTechStatsQuery.mockReturnValue({ data: [], isLoading: false });

    render(
      <RegionDetailPanel
        regionId="台北市信義區"
        displayName="台北市信義區"
        totalJobCount={42}
      />,
    );

    expect(screen.getByText('台北市信義區')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders up to 10 tech rows sorted by job count descending when job count > 0', () => {
    const rows = [
      makeTechStat('react', 30),
      makeTechStat('typescript', 25),
      makeTechStat('vue', 20),
      makeTechStat('a', 19),
      makeTechStat('b', 18),
      makeTechStat('c', 17),
      makeTechStat('d', 16),
      makeTechStat('e', 15),
      makeTechStat('f', 14),
      makeTechStat('g', 13),
      // 11th row -- must NOT be rendered even though the mocked hook
      // returned it (defensive client-side cap, in addition to the
      // `to: 9` server-side limit already asserted above).
      makeTechStat('eleventh', 12),
    ];
    useLocationTechStatsQuery.mockReturnValue({ data: rows, isLoading: false });

    render(
      <RegionDetailPanel
        regionId="台北市信義區"
        displayName="台北市信義區"
        totalJobCount={200}
      />,
    );

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
      data: [makeTechStat('unknown-tech', 5)],
      isLoading: false,
    });

    render(
      <RegionDetailPanel
        regionId="台北市信義區"
        displayName="台北市信義區"
        totalJobCount={5}
      />,
    );

    expect(screen.getByText('unknown-tech')).toBeInTheDocument();
  });

  it('renders a no-data message and ZERO tech rows when the total job count is 0 (Requirement 5.3)', () => {
    // Even if the mocked hook somehow still returned rows, the tech ranking
    // list must be entirely absent -- not even an empty list -- once the
    // region's total open-job count is 0.
    useLocationTechStatsQuery.mockReturnValue({
      data: [makeTechStat('react', 3)],
      isLoading: false,
    });

    render(
      <RegionDetailPanel
        regionId="台北市信義區"
        displayName="台北市信義區"
        totalJobCount={0}
      />,
    );

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByText('React')).not.toBeInTheDocument();
    expect(screen.getByText(/沒有開放中職缺/)).toBeInTheDocument();
  });
});
