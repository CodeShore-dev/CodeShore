import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// 行動裝置斷點 hook 直接 mock 為 true：本檔專測「行動裝置版面下的放大＋
// 可拖曳捲動」行為（桌機行為由 RegionChoropleth.test.tsx 隱含覆蓋——
// test-setup 的 matchMedia 預設不匹配、useIsMobile 回傳 false）。
vi.mock('../hooks/useIsMobile', () => ({ useIsMobile: () => true }));

import { RegionChoropleth, type RegionFeature } from './RegionChoropleth';

function squareFeature(id: string, x: number, size: number): RegionFeature {
  return {
    id,
    displayName: id,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [x, 0],
          [x, size],
          [x + size, size],
          [x + size, 0],
          [x, 0],
        ],
      ],
    },
  };
}

describe('RegionChoropleth (mobile zoom)', () => {
  it('zooms and enables drag-scrolling with mobileInitialFocusIds, scrolled to the focus regions', () => {
    render(
      <RegionChoropleth
        features={[squareFeature('甲縣', 0, 10), squareFeature('乙縣', 15, 10)]}
        valueByRegionId={new Map([['甲縣', 5], ['乙縣', 3]])}
        maxValue={5}
        selectedRegionId={null}
        onSelect={vi.fn()}
        mobileInitialFocusIds={['甲縣']}
      />,
    );

    const container = screen.getByTestId('region-map-mobile-scroll');
    const svg = container.querySelector('svg');
    // 放大 3 倍（viewBox 800x600 -> 實際 2400x1800），其餘靠拖曳捲動。
    expect(svg?.getAttribute('width')).toBe('2400');
    expect(svg?.getAttribute('height')).toBe('1800');
    // 初始捲動置中聚焦地區（甲縣在地圖左半，中心點 x 必然小於整張地圖的
    // 中心 400）；jsdom 的 clientWidth 為 0，scrollLeft = 中心點 x * 3。
    expect(container.scrollLeft).toBeGreaterThan(0);
    expect(container.scrollLeft).toBeLessThan(400 * 3);
  });

  it('still zooms after drilling down (no mobileInitialFocusIds), scrolled to the whole-map center', () => {
    render(
      <RegionChoropleth
        features={[squareFeature('某區', 0, 10)]}
        valueByRegionId={new Map([['某區', 5]])}
        maxValue={5}
        selectedRegionId={null}
        onSelect={vi.fn()}
      />,
    );

    // 下鑽後呼叫端不再提供聚焦清單，行動裝置版面仍需放大到適合閱讀/點擊
    // 的大小，初始視角退回整張地圖的中心。
    const container = screen.getByTestId('region-map-mobile-scroll');
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('2400');
    // 單一形狀經 fitSize 置中，整張地圖中心約在 (400, 300) -> 捲動位置約
    // (1200, 900)；Mercator 投影的非線性讓實際值略有偏差，容忍 ±50。
    expect(container.scrollLeft).toBeCloseTo(1200, -2);
    expect(container.scrollTop).toBeCloseTo(900, -2);
  });

  it('renders no scroll container when there are no features (nothing to zoom into)', () => {
    render(
      <RegionChoropleth
        features={[]}
        valueByRegionId={new Map()}
        maxValue={0}
        selectedRegionId={null}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('region-map-mobile-scroll')).not.toBeInTheDocument();
  });
});
