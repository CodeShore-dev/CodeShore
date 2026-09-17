import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// TechIcon 內部會非同步抓取外部 icon 資源（jsdom 下必然失敗、且會觸發
// act 警告），此元件測試只關心「每一列都有帶入 icon」的組裝行為，因此
// 以同步 stub 取代，保留 label 供斷言對應到正確的列。
vi.mock('../../../components/TechIcon', () => ({
  TechIcon: ({ label }: { label?: string | null }) => (
    <span data-testid="tech-icon" data-label={label} />
  ),
}));

import type { CategoryGroup } from '../hooks/useRegionTechCategoryRanking';
import { RegionTechCategoryList } from './RegionTechCategoryList';

const buildGroups = (): CategoryGroup[] => [
  {
    category: 'language',
    label: '語言',
    rows: [
      { tech: 'typescript', label: 'TypeScript', iconSlugs: null, jobCount: 1234 },
      { tech: 'python', label: 'Python', iconSlugs: null, jobCount: 80 },
    ],
  },
  {
    category: 'framework',
    label: '框架',
    rows: [
      { tech: 'react', label: 'React', iconSlugs: null, jobCount: 150 },
      { tech: 'vue', label: 'Vue', iconSlugs: null, jobCount: 60 },
      { tech: 'angular', label: 'Angular', iconSlugs: null, jobCount: 20 },
    ],
  },
];

describe('RegionTechCategoryList', () => {
  it('每個分類同時渲染圓餅圖與 tech item 列表（無檢視切換按鈕）', () => {
    render(
      <RegionTechCategoryList categoryGroups={buildGroups()} onSelectTech={vi.fn()} />,
    );

    // 兩個分類各一張圓餅圖；切片數 = 各分類列數總和（語言 2 + 框架 3）。
    expect(screen.getAllByTestId('region-tech-pie')).toHaveLength(2);
    expect(screen.getAllByTestId('region-tech-pie-slice')).toHaveLength(5);
    // tech item 列與圓餅圖並存，不再有「圓餅圖/列表」切換。
    expect(screen.getAllByTestId('region-tech-row')).toHaveLength(5);
    expect(screen.queryByRole('button', { name: '圓餅圖' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '列表' })).not.toBeInTheDocument();

    expect(screen.getByText('語言')).toBeInTheDocument();
    expect(screen.getByText('框架')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Vue')).toBeInTheDocument();
    expect(screen.getByText('Angular')).toBeInTheDocument();
  });

  it('每一列 tech item 都帶有該技術的 icon', () => {
    render(
      <RegionTechCategoryList categoryGroups={buildGroups()} onSelectTech={vi.fn()} />,
    );

    const icons = screen.getAllByTestId('tech-icon');
    expect(icons).toHaveLength(5);
    expect(icons.map(i => i.getAttribute('data-label'))).toEqual([
      'TypeScript',
      'Python',
      'React',
      'Vue',
      'Angular',
    ]);
  });

  it('職缺數以 .toLocaleString() 格式呈現（四位數需有千分位逗號，與純數字內插不同）', () => {
    render(
      <RegionTechCategoryList categoryGroups={buildGroups()} onSelectTech={vi.fn()} />,
    );

    // 1234 的 .toLocaleString() 結果為 "1,234"，與純數字內插的 "1234" 不同，
    // 若元件退化為直接內插數字，此斷言會真的失敗（而非巧合通過）。
    expect((1234).toLocaleString()).toBe('1,234');
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.queryByText('1234')).not.toBeInTheDocument();
  });

  it('列尾顯示「列出各列彼此之間」的職缺數占比', () => {
    render(
      <RegionTechCategoryList categoryGroups={buildGroups()} onSelectTech={vi.fn()} />,
    );

    // 語言分類：1234 / (1234 + 80) ≈ 94%、80 / 1314 ≈ 6%。
    expect(screen.getByText('94%')).toBeInTheDocument();
    expect(screen.getByText('6%')).toBeInTheDocument();
  });

  it('點擊某分類中的列會以該列的 tech id 呼叫 onSelectTech', () => {
    const onSelectTech = vi.fn();
    render(
      <RegionTechCategoryList categoryGroups={buildGroups()} onSelectTech={onSelectTech} />,
    );

    fireEvent.click(screen.getByText('Python'));
    expect(onSelectTech).toHaveBeenCalledWith('python');
    expect(onSelectTech).toHaveBeenCalledTimes(1);
  });

  it('點擊另一個分類中的列同樣會帶出正確的 tech id（非巧合命中第一列）', () => {
    const onSelectTech = vi.fn();
    render(
      <RegionTechCategoryList categoryGroups={buildGroups()} onSelectTech={onSelectTech} />,
    );

    fireEvent.click(screen.getByText('Vue'));
    expect(onSelectTech).toHaveBeenCalledWith('vue');
    expect(onSelectTech).toHaveBeenCalledTimes(1);
  });

  it('點擊圓餅圖切片同樣會以該切片的 tech id 呼叫 onSelectTech', () => {
    const onSelectTech = vi.fn();
    const { container } = render(
      <RegionTechCategoryList categoryGroups={buildGroups()} onSelectTech={onSelectTech} />,
    );

    const slice = container.querySelector(
      '[data-testid="region-tech-pie-slice"][data-tech="vue"]',
    );
    expect(slice).not.toBeNull();
    fireEvent.click(slice!);
    expect(onSelectTech).toHaveBeenCalledWith('vue');
  });

  it('分類只有一筆技術（占比 100%）時仍渲染出一個可點擊的整圓切片，不拋錯', () => {
    const onSelectTech = vi.fn();
    const { container } = render(
      <RegionTechCategoryList
        categoryGroups={[
          {
            category: 'language',
            label: '語言',
            rows: [
              { tech: 'python', label: 'Python', iconSlugs: null, jobCount: 80 },
            ],
          },
        ]}
        onSelectTech={onSelectTech}
      />,
    );

    expect(screen.getAllByTestId('region-tech-pie-slice')).toHaveLength(1);
    expect(screen.getByText('100%')).toBeInTheDocument();

    fireEvent.click(
      container.querySelector(
        '[data-testid="region-tech-pie-slice"][data-tech="python"]',
      )!,
    );
    expect(onSelectTech).toHaveBeenCalledWith('python');
  });

  it('每個分類標題旁都有說明技術排行計算方式的 info hint', () => {
    render(
      <RegionTechCategoryList categoryGroups={buildGroups()} onSelectTech={vi.fn()} />,
    );

    expect(
      screen.getAllByRole('button', { name: '查看技術排行如何計算' }),
    ).toHaveLength(2);
  });

  it('categoryGroups 為空陣列時不拋錯，且不渲染任何分類標題或列', () => {
    const { container } = render(
      <RegionTechCategoryList categoryGroups={[]} onSelectTech={vi.fn()} />,
    );

    expect(screen.queryByTestId('region-tech-row')).not.toBeInTheDocument();
    expect(screen.queryByTestId('region-tech-pie')).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-tech]')).toHaveLength(0);
  });
});
