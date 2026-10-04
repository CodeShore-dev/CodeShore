import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { HomeHotCombos } from './HomeHotCombos';

function comboRow(tech1: string, tech1Label: string) {
  return {
    tech1,
    tech2: 'docker',
    tech1_label: tech1Label,
    tech2_label: 'Docker',
    tech1_icons: [],
    tech2_icons: [],
    tech2_tags: [],
    job_count: 120,
    median_min_year: 1000000,
    median_max_year: 1400000,
    median_min_month: 70000,
    median_max_month: 90000,
  };
}

describe('HomeHotCombos', () => {
  it('標題用傳入的分類標籤，不再寫死「語言」', () => {
    const { container } = renderWithProviders(
      <HomeHotCombos tech="react" categoryLabel="框架" items={[comboRow('react', 'React')]} />,
    );

    expect(container.textContent).toContain('與 React 框架最常同時出現的技術組合');
    expect(container.textContent).not.toContain('語言最常同時出現');
  });

  it('沒有分類標籤時標題不插入任何分類字樣', () => {
    const { container } = renderWithProviders(
      <HomeHotCombos tech="postgresql" items={[comboRow('postgresql', 'PostgreSQL')]} />,
    );

    expect(container.textContent).toContain('與 PostgreSQL 最常同時出現的技術組合');
  });

  it('沒有組合且不在載入中時不渲染任何內容', () => {
    const { container } = renderWithProviders(<HomeHotCombos tech="go" categoryLabel="語言" items={[]} />);

    expect(container.querySelector('section')).toBeNull();
  });
});
