import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `RegionSummaryPopup` calls three already-committed hooks unconditionally
// (task 17.3, design.md `RegionSummaryPopup`（Props Contract）依賴清單:
// `useRegionSalaryStats`, `useRegionTechCategoryRanking`,
// `useRegionJobsNavigation`). This spec mocks at that boundary -- the same
// convention `RegionDetailPanel.test.tsx` used for its own hook dependencies
// -- rather than mocking the underlying `queries.ts`/HTTP layer, since this
// component's own responsibility is composing those hooks' outputs into the
// Modal, not re-deriving their internal aggregation logic (already covered
// by each hook's own spec file).
const { useRegionSalaryStats } = vi.hoisted(() => ({
  useRegionSalaryStats: vi.fn(),
}));
vi.mock('../hooks/useRegionSalaryStats', () => ({ useRegionSalaryStats }));

const { useRegionTechCategoryRanking } = vi.hoisted(() => ({
  useRegionTechCategoryRanking: vi.fn(),
}));
vi.mock('../hooks/useRegionTechCategoryRanking', () => ({
  useRegionTechCategoryRanking,
}));

const { useRegionJobsNavigation } = vi.hoisted(() => ({
  useRegionJobsNavigation: vi.fn(),
}));
vi.mock('../hooks/useRegionJobsNavigation', () => ({ useRegionJobsNavigation }));

import { RegionSummaryPopup, RegionSummaryPopupProps } from './RegionSummaryPopup';

const ZERO_STAT = { jobCount: 0, avgSalary: null };
const ZERO_SALARY_STATS = { month: ZERO_STAT, year: ZERO_STAT };

const SAMPLE_SALARY_STATS = {
  month: { jobCount: 120, avgSalary: 55000 },
  year: { jobCount: 45, avgSalary: 1200000 },
};

const SAMPLE_CATEGORY_GROUPS = [
  {
    category: 'language',
    label: '語言',
    rows: [
      { tech: 'python', label: 'Python', iconSlugs: null, jobCount: 80 },
    ],
  },
];

function renderPopup(
  overrides: Partial<RegionSummaryPopupProps> = {},
  navMocks: { goToJobs?: () => void; goToJobsWithTech?: (techId: string) => void } = {},
) {
  useRegionJobsNavigation.mockReturnValue({
    goToJobs: navMocks.goToJobs ?? vi.fn(),
    goToJobsWithTech: navMocks.goToJobsWithTech ?? vi.fn(),
  });

  const props: RegionSummaryPopupProps = {
    regionId: '台北市信義區',
    displayName: '台北市信義區',
    tier: 'district',
    totalJobCount: 42,
    onClose: vi.fn(),
    ...overrides,
  };

  return { ...render(<RegionSummaryPopup {...props} />), props };
}

beforeEach(() => {
  vi.clearAllMocks();
  useRegionSalaryStats.mockReturnValue(SAMPLE_SALARY_STATS);
  useRegionTechCategoryRanking.mockReturnValue(SAMPLE_CATEGORY_GROUPS);
  useRegionJobsNavigation.mockReturnValue({
    goToJobs: vi.fn(),
    goToJobsWithTech: vi.fn(),
  });
});

describe('RegionSummaryPopup', () => {
  it('regionId 為 null 時 Modal 不渲染任何內容（Requirement 5.9 對應的關閉狀態）', () => {
    renderPopup({ regionId: null });

    expect(screen.queryByTestId('modal-backdrop')).not.toBeInTheDocument();
    expect(screen.queryByText('台北市信義區')).not.toBeInTheDocument();
  });

  it('totalJobCount 為 0 時只顯示無資料說明，不掛載 RegionSalarySummary/RegionTechCategoryList（Requirement 5.6）', () => {
    useRegionSalaryStats.mockReturnValue(ZERO_SALARY_STATS);
    useRegionTechCategoryRanking.mockReturnValue([]);

    renderPopup({ totalJobCount: 0 });

    expect(screen.getByText(/沒有開放中職缺/)).toBeInTheDocument();
    // Salary summary block must not be mounted at all.
    expect(screen.queryByText('月薪')).not.toBeInTheDocument();
    expect(screen.queryByText('年薪')).not.toBeInTheDocument();
    // Tech category list must not be mounted at all.
    expect(screen.queryByText('語言')).not.toBeInTheDocument();
    expect(screen.queryByText('Python')).not.toBeInTheDocument();
  });

  it('totalJobCount 為 0 時，district 層級「查看此地區職缺」按鈕仍然顯示且可點擊呼叫 goToJobs（Requirement 6.1/6.2 不受職缺數綁定）', async () => {
    useRegionSalaryStats.mockReturnValue(ZERO_SALARY_STATS);
    useRegionTechCategoryRanking.mockReturnValue([]);
    const goToJobs = vi.fn();
    const user = userEvent.setup();

    renderPopup({ tier: 'district', totalJobCount: 0 }, { goToJobs });

    const button = screen.getByRole('button', { name: '查看此地區職缺' });
    await user.click(button);

    expect(goToJobs).toHaveBeenCalledTimes(1);
  });

  it('totalJobCount 為 0 時，county 層級「查看此地區職缺」按鈕仍然顯示且可點擊呼叫 goToJobs（Requirement 6.1/6.2 不受職缺數綁定）', async () => {
    useRegionSalaryStats.mockReturnValue(ZERO_SALARY_STATS);
    useRegionTechCategoryRanking.mockReturnValue([]);
    const goToJobs = vi.fn();
    const user = userEvent.setup();

    renderPopup(
      {
        tier: 'county',
        regionId: '台北市',
        displayName: '台北市',
        totalJobCount: 0,
        onDrillDown: vi.fn(),
      },
      { goToJobs },
    );

    const button = screen.getByRole('button', { name: '查看此地區職缺' });
    await user.click(button);

    expect(goToJobs).toHaveBeenCalledTimes(1);
  });

  it('totalJobCount > 0 時渲染職缺總數、薪資概況與技術分類排行', () => {
    renderPopup({ totalJobCount: 42 });

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('月薪')).toBeInTheDocument();
    expect(screen.getByText('年薪')).toBeInTheDocument();
    expect(screen.getByText('語言')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.queryByText(/沒有開放中職缺/)).not.toBeInTheDocument();
  });

  it('tier === county 時顯示「查看鄉鎮市區分布」按鈕，點擊後呼叫 onDrillDown（Requirement 3.2）', async () => {
    const onDrillDown = vi.fn();
    const user = userEvent.setup();

    renderPopup({
      tier: 'county',
      regionId: '台北市',
      displayName: '台北市',
      onDrillDown,
    });

    const button = screen.getByRole('button', { name: '查看鄉鎮市區分布' });
    await user.click(button);

    expect(onDrillDown).toHaveBeenCalledTimes(1);
  });

  it('county 層級即使 totalJobCount 為 0，「查看鄉鎮市區分布」按鈕仍然顯示（下鑽不受職缺數影響）', () => {
    useRegionSalaryStats.mockReturnValue(ZERO_SALARY_STATS);
    useRegionTechCategoryRanking.mockReturnValue([]);

    renderPopup({
      tier: 'county',
      regionId: '台北市',
      displayName: '台北市',
      totalJobCount: 0,
      onDrillDown: vi.fn(),
    });

    expect(
      screen.getByRole('button', { name: '查看鄉鎮市區分布' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/沒有開放中職缺/)).toBeInTheDocument();
  });

  it('tier === district 時不顯示「查看鄉鎮市區分布」按鈕', () => {
    renderPopup({ tier: 'district' });

    expect(
      screen.queryByRole('button', { name: '查看鄉鎮市區分布' }),
    ).not.toBeInTheDocument();
  });

  it('點擊 Modal 的關閉按鈕觸發 onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderPopup({ onClose });

    await user.click(screen.getByRole('button', { name: '關閉' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('點擊「查看此地區職缺」呼叫 useRegionJobsNavigation 回傳的 goToJobs（Requirement 6.1/6.2）', async () => {
    const goToJobs = vi.fn();
    const user = userEvent.setup();

    renderPopup({ totalJobCount: 42 }, { goToJobs });

    await user.click(screen.getByRole('button', { name: '查看此地區職缺' }));

    expect(goToJobs).toHaveBeenCalledTimes(1);
  });

  it('點擊技術排行中的一列呼叫 goToJobsWithTech 並帶出正確的 tech id（Requirement 6.3）', async () => {
    const goToJobsWithTech = vi.fn();
    const user = userEvent.setup();

    renderPopup({ totalJobCount: 42 }, { goToJobsWithTech });

    await user.click(screen.getByText('Python'));

    expect(goToJobsWithTech).toHaveBeenCalledWith('python');
    expect(goToJobsWithTech).toHaveBeenCalledTimes(1);
  });
});
