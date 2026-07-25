import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
  it('依分類垂直堆疊渲染各分類標題與正確列數', () => {
    render(
      <RegionTechCategoryList categoryGroups={buildGroups()} onSelectTech={vi.fn()} />,
    );

    expect(screen.getByText('語言')).toBeInTheDocument();
    expect(screen.getByText('框架')).toBeInTheDocument();

    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Vue')).toBeInTheDocument();
    expect(screen.getByText('Angular')).toBeInTheDocument();

    // 語言分類 2 列、框架分類 3 列
    expect(screen.getAllByTestId('region-tech-row')).toHaveLength(5);
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

  it('categoryGroups 為空陣列時不拋錯，且不渲染任何分類標題或列', () => {
    const { container } = render(
      <RegionTechCategoryList categoryGroups={[]} onSelectTech={vi.fn()} />,
    );

    expect(screen.queryByTestId('region-tech-row')).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-tech]')).toHaveLength(0);
  });
});
