import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getRegionColor } from '../utils/colorScale';
import { normalizeCountyName, toRegionKey } from '../utils/regionId';
import {
  getCountiesFeatureCollection,
  getTownsFeatureCollection,
} from '../utils/taiwanAtlasData';
import { RegionChoropleth, type RegionFeature } from './RegionChoropleth';

/**
 * 縣市層 `RegionFeature[]` 建構——比照 design.md「呼叫端」職責：
 * `RegionChoropleth` 本身不建構 features（任務 6.1 僅測試以此縣市資料集
 * 驅動的渲染行為，元件本身維持 features/topology 全 prop-driven，供任務
 * 6.3 的鄉鎮市區層重用同一元件）。
 */
function buildCountyFeatures(): RegionFeature[] {
  return getCountiesFeatureCollection().features.map(feature => {
    const id = normalizeCountyName(feature.properties.COUNTYNAME);
    return {
      id,
      displayName: id,
      geometry: feature.geometry,
    };
  });
}

/**
 * 鄉鎮市區層 `RegionFeature[]` 建構（任務 6.3）——比照 design.md「呼叫端」
 * 職責：由呼叫端（`LocationMapPage`／`useRegionValueMaps`）從 `towns-10t`
 * 篩出「單一縣市」的子集傳入 `RegionChoropleth`；`id` 採用可與
 * `location_group.id` 直接比對的字串鍵（`utils/regionId.toRegionKey`）。
 */
function buildTownFeatures(countyName: string): RegionFeature[] {
  return getTownsFeatureCollection()
    .features.filter(
      feature => normalizeCountyName(feature.properties.COUNTYNAME) === countyName,
    )
    .map(feature => {
      const id = toRegionKey(feature.properties.COUNTYNAME, feature.properties.TOWNNAME);
      return {
        id,
        displayName: feature.properties.TOWNNAME,
        geometry: feature.geometry,
      };
    });
}

describe('RegionChoropleth (county tier)', () => {
  it('renders all 22 counties as SVG paths, including counties absent from valueByRegionId', () => {
    const features = buildCountyFeatures();
    const valueByRegionId = new Map<string, number>([
      ['台北市', 120],
      ['新北市', 80],
    ]);

    const { container } = render(
      <RegionChoropleth
        features={features}
        valueByRegionId={valueByRegionId}
        maxValue={120}
        selectedRegionId={null}
        onSelect={() => {}}
      />,
    );

    const paths = container.querySelectorAll('path');
    expect(paths).toHaveLength(22);

    // Every county id (including ones with no entry in valueByRegionId, i.e. 0 jobs)
    // must be present and rendered — never filtered out.
    const ids = features.map(f => f.id);
    expect(new Set(ids).size).toBe(22);
  });

  it('colors a county with no entry in valueByRegionId using getRegionColor(0, maxValue)', () => {
    const features = buildCountyFeatures();
    const valueByRegionId = new Map<string, number>([['台北市', 120]]);
    const maxValue = 120;

    render(
      <RegionChoropleth
        features={features}
        valueByRegionId={valueByRegionId}
        maxValue={maxValue}
        selectedRegionId={null}
        onSelect={() => {}}
      />,
    );

    const zeroValueCounty = features.find(f => f.id !== '台北市');
    expect(zeroValueCounty).toBeDefined();

    const path = document.querySelector(`path[data-region-id="${zeroValueCounty!.id}"]`);
    expect(path).not.toBeNull();
    expect(path?.getAttribute('fill')).toBe(getRegionColor(0, maxValue));
  });

  it('colors a county present in valueByRegionId using getRegionColor(value, maxValue)', () => {
    const features = buildCountyFeatures();
    const valueByRegionId = new Map<string, number>([['台北市', 120]]);
    const maxValue = 120;

    render(
      <RegionChoropleth
        features={features}
        valueByRegionId={valueByRegionId}
        maxValue={maxValue}
        selectedRegionId={null}
        onSelect={() => {}}
      />,
    );

    const path = document.querySelector('path[data-region-id="台北市"]');
    expect(path).not.toBeNull();
    expect(path?.getAttribute('fill')).toBe(getRegionColor(120, maxValue));
  });

  it('calls onSelect with the correct region id when a county path is clicked', () => {
    const features = buildCountyFeatures();
    const onSelect = vi.fn();

    render(
      <RegionChoropleth
        features={features}
        // Empty regions are non-interactive (see the dedicated describe
        // block below), so this region needs a non-zero value to remain
        // clickable.
        valueByRegionId={new Map([['台北市', 1]])}
        maxValue={100}
        selectedRegionId={null}
        onSelect={onSelect}
      />,
    );

    const path = document.querySelector('path[data-region-id="台北市"]');
    expect(path).not.toBeNull();

    fireEvent.click(path!);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('台北市');
  });

  it('exposes the job count via a native <title> tooltip element for hover/click discoverability', () => {
    const features = buildCountyFeatures();
    const valueByRegionId = new Map<string, number>([['台北市', 120]]);

    render(
      <RegionChoropleth
        features={features}
        valueByRegionId={valueByRegionId}
        maxValue={120}
        selectedRegionId={null}
        onSelect={() => {}}
      />,
    );

    const path = document.querySelector('path[data-region-id="台北市"]');
    const title = path?.querySelector('title');
    expect(title).not.toBeNull();
    expect(title?.textContent).toContain('120');
  });

  it('also renders the name and job count as always-visible SVG text for a region with jobs, not only on hover', () => {
    // Only two comparably-sized counties driving fitSize themselves (rather
    // than all 22, where remote outlying islands shrink every mainland
    // county's rendered size and make some fall under the label-overflow
    // thresholds covered separately below) -- both occupy a large share of
    // the viewBox, so both reliably clear the name+count threshold.
    const features = buildCountyFeatures().filter(
      f => f.id === '台北市' || f.id === '新北市',
    );
    const valueByRegionId = new Map<string, number>([['台北市', 120]]);

    const { container } = render(
      <RegionChoropleth
        features={features}
        valueByRegionId={valueByRegionId}
        maxValue={120}
        selectedRegionId={null}
        onSelect={() => {}}
      />,
    );

    // 新北市 has 0 jobs -- no label at all (see the dedicated empty-region
    // describe block below), so only 台北市's <text> exists.
    expect(container.querySelectorAll('text')).toHaveLength(1);
    expect(container.querySelector('text')?.textContent).toBe('台北市120');
    expect(container.querySelector('text[data-region-id="新北市"]')).toBeNull();
  });

  it('does not throw and renders an empty svg when features is empty', () => {
    render(
      <RegionChoropleth
        features={[]}
        valueByRegionId={new Map()}
        maxValue={0}
        selectedRegionId={null}
        onSelect={() => {}}
      />,
    );

    expect(document.querySelectorAll('path')).toHaveLength(0);
  });
});

/**
 * 0 筆職缺地區反灰、不可點選（本次異動）：地圖仍需顯示這些地區的形狀
 * （Requirement 2.2, 3.4 的「不得隱藏」不變），但不再提供點擊互動，畫面上
 * 也不再畫出「地名+0」這種佔位標籤——反灰本身已足以傳達「這裡沒有職缺」。
 */
describe('RegionChoropleth (empty regions are grayed out and non-interactive)', () => {
  it('does not call onSelect when a 0-job region is clicked', () => {
    const features = buildCountyFeatures();
    const onSelect = vi.fn();

    render(
      <RegionChoropleth
        features={features}
        valueByRegionId={new Map([['台北市', 120]])}
        maxValue={120}
        selectedRegionId={null}
        onSelect={onSelect}
      />,
    );

    const zeroValueCounty = features.find(f => f.id !== '台北市')!;
    const path = document.querySelector(`path[data-region-id="${zeroValueCounty.id}"]`)!;
    fireEvent.click(path);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('removes the button role and pointer-cursor styling from a 0-job region', () => {
    const features = buildCountyFeatures();

    render(
      <RegionChoropleth
        features={features}
        valueByRegionId={new Map([['台北市', 120]])}
        maxValue={120}
        selectedRegionId={null}
        onSelect={() => {}}
      />,
    );

    const zeroValueCounty = features.find(f => f.id !== '台北市')!;
    const path = document.querySelector(`path[data-region-id="${zeroValueCounty.id}"]`)!;

    expect(path.getAttribute('role')).toBeNull();
    expect(path.className.baseVal).not.toContain('cursor-pointer');
  });

  it('still keeps the button role, click handler, and pointer-cursor styling for a region with jobs', () => {
    const features = buildCountyFeatures();
    const onSelect = vi.fn();

    render(
      <RegionChoropleth
        features={features}
        valueByRegionId={new Map([['台北市', 120]])}
        maxValue={120}
        selectedRegionId={null}
        onSelect={onSelect}
      />,
    );

    const path = document.querySelector('path[data-region-id="台北市"]')!;
    expect(path.getAttribute('role')).toBe('button');
    expect(path.className.baseVal).toContain('cursor-pointer');

    fireEvent.click(path);
    expect(onSelect).toHaveBeenCalledWith('台北市');
  });

  it('does not render any SVG text label for a 0-job region, even when its shape is large enough to fit one', () => {
    const features = buildCountyFeatures().filter(
      f => f.id === '台北市' || f.id === '新北市',
    );

    const { container } = render(
      <RegionChoropleth
        features={features}
        valueByRegionId={new Map([['台北市', 120]])}
        maxValue={120}
        selectedRegionId={null}
        onSelect={() => {}}
      />,
    );

    expect(container.querySelector('text[data-region-id="新北市"]')).toBeNull();
  });

  it('still exposes the region name via the native <title> tooltip on a 0-job region, so it stays identifiable on hover', () => {
    const features = buildCountyFeatures();

    render(
      <RegionChoropleth
        features={features}
        valueByRegionId={new Map([['台北市', 120]])}
        maxValue={120}
        selectedRegionId={null}
        onSelect={() => {}}
      />,
    );

    const zeroValueCounty = features.find(f => f.id !== '台北市')!;
    const path = document.querySelector(`path[data-region-id="${zeroValueCounty.id}"]`)!;
    expect(path.querySelector('title')?.textContent).toBe(`${zeroValueCounty.displayName}：0 筆職缺`);
  });
});

/**
 * 標籤溢出處理：形狀在畫面上實際渲染出的像素尺寸差距懸殊時（例如全台縣市
 * 或某縣市鄉鎮市區並列），固定字級的永遠可見標籤會讓小形狀的文字明顯溢出
 * 邊界甚至互相重疊。改用「依 pathGenerator.bounds() 換算出的實際渲染尺寸」
 * 分三層決定顯示內容：夠大顯示名稱+數字、中等只顯示數字、太小則完全不顯示
 * （點擊與 hover title 兩者不受影響，只是不再永遠佔用畫面）。
 *
 * 使用簡單方形合成幾何（而非真實 taiwan-atlas 座標）讓三層的實際渲染像素
 * 尺寸可預先精算、跨環境穩定重現，不依賴特定縣市在真實地圖上恰好多大。
 */
describe('RegionChoropleth (label overflow handling)', () => {
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

  // 三個方形彼此不重疊、尺寸差距懸殊：合併後的 fitSize 換算比例會讓三者的
  // 實際渲染尺寸分別落在「>=40px」「14-40px」「<14px」三個門檻區間內
  // （已依 VIEWBOX 800x600 扣掉 FIT_SIZE_PADDING 後的實際換算比例精算，並
  // 留有數倍安全邊界，可容許 Mercator 投影的些微非線性誤差）。
  const BIG = squareFeature('大縣', 0, 10);
  const MEDIUM = squareFeature('中鎮', 30, 2);
  const TINY = squareFeature('小村', 60, 0.5);
  const features = [BIG, MEDIUM, TINY];

  it('shows the full name + count label for a region large enough on screen', () => {
    const { container } = render(
      <RegionChoropleth
        features={features}
        valueByRegionId={new Map([['大縣', 88]])}
        maxValue={88}
        selectedRegionId={null}
        onSelect={() => {}}
      />,
    );

    const text = container.querySelector('text[data-region-id="大縣"]');
    expect(text?.textContent).toBe('大縣88');
  });

  it('shows only the job count (no name) for a region too small to fit a full name label', () => {
    const { container } = render(
      <RegionChoropleth
        features={features}
        valueByRegionId={new Map([['中鎮', 5]])}
        maxValue={88}
        selectedRegionId={null}
        onSelect={() => {}}
      />,
    );

    const text = container.querySelector('text[data-region-id="中鎮"]');
    expect(text?.textContent).toBe('5');
  });

  it('hides the label entirely for a region small enough that any text would overflow its shape', () => {
    const { container } = render(
      <RegionChoropleth
        features={features}
        valueByRegionId={new Map([['小村', 3]])}
        maxValue={88}
        selectedRegionId={null}
        onSelect={() => {}}
      />,
    );

    expect(container.querySelector('text[data-region-id="小村"]')).toBeNull();
    // 沒有永遠可見標籤不代表資訊消失：點擊與 hover title 仍在。
    expect(
      container.querySelector('path[data-region-id="小村"]')?.getAttribute('aria-label'),
    ).toContain('3 筆職缺');
  });

  it("keeps every label after every path in document order, so a label is never painted underneath a neighboring region's shape", () => {
    const { container } = render(
      <RegionChoropleth
        features={features}
        valueByRegionId={new Map([['大縣', 88]])}
        maxValue={88}
        selectedRegionId={null}
        onSelect={() => {}}
      />,
    );

    // SVG 依文件順序疊圖：只要每個 <text> 都排在「全部」<path> 之後，
    // 標籤就必然畫在所有形狀之上，不會被任一（尤其是較晚渲染、視覺上蓋在
    // 上層的）鄰近形狀蓋住或裁切。
    const nodes = Array.from(container.querySelectorAll('svg > *'));
    const lastPathIndex = nodes.map(n => n.tagName).lastIndexOf('path');
    const firstTextIndex = nodes.map(n => n.tagName).indexOf('text');
    expect(firstTextIndex).toBeGreaterThan(lastPathIndex);
  });
});

/**
 * 鄉鎮市區下鑽（任務 6.3，design.md「RegionChoropleth（Props Contract）」：
 * 「縣市層與鄉鎮市區層共用此元件，差異僅在呼叫端傳入的 features…」）。
 *
 * 這裡驗證的是：`RegionChoropleth` 收到「單一縣市的 towns-10t 子集」時，
 * 沿用同一條 `buildRegionPaths`（`fitSize` 對「傳入的 features」而非固定
 * 的全台縣市範圍）渲染邏輯，因此下鑽渲染不需要元件內任何額外分支。
 */
describe('RegionChoropleth (township tier drill-down, task 6.3)', () => {
  /**
   * 從 d3-geo `geoPath` 產生的 SVG path `d` 字串粗略估算其座標範圍
   * （bounding box）寬度。`buildRegionPaths` 只用 `M`/`L` 指令繪製多邊形
   * （無曲線),因此座標一律以 x,y 交錯排列，可用正規表示式取出所有數字後
   * 依序配對取得 x 座標序列，不需要完整解析 path 語法。
   */
  function estimateBBoxWidth(dAttrs: readonly string[]): number {
    const xs: number[] = [];
    for (const d of dAttrs) {
      const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
      for (let i = 0; i < numbers.length; i += 2) {
        xs.push(numbers[i]);
      }
    }
    return Math.max(...xs) - Math.min(...xs);
  }

  it('renders all townships of the drilled-into county as SVG paths, including zero-job townships (Requirement 3.1, 3.3)', () => {
    const features = buildTownFeatures('台北市');
    // Sanity check against the real taiwan-atlas fixture: 台北市 has 12 districts.
    expect(features.length).toBe(12);

    const valueByRegionId = new Map<string, number>([[features[0].id, 50]]);

    const { container } = render(
      <RegionChoropleth
        features={features}
        valueByRegionId={valueByRegionId}
        maxValue={50}
        selectedRegionId={null}
        onSelect={() => {}}
      />,
    );

    const paths = container.querySelectorAll('path');
    expect(paths).toHaveLength(12);

    // Every township, including those absent from valueByRegionId (0 jobs), must
    // still be rendered — never filtered out (same rule as the county tier).
    const zeroJobTownship = features.find(f => f.id !== features[0].id);
    expect(zeroJobTownship).toBeDefined();
    const zeroPath = document.querySelector(`path[data-region-id="${zeroJobTownship!.id}"]`);
    expect(zeroPath).not.toBeNull();
    expect(zeroPath?.getAttribute('fill')).toBe(getRegionColor(0, 50));
  });

  it('calls onSelect with the location_group.id-compatible district id when a township path is clicked', () => {
    const features = buildTownFeatures('台北市');
    const onSelect = vi.fn();
    const target = features[0];

    render(
      <RegionChoropleth
        features={features}
        // Empty regions are non-interactive (see the dedicated describe
        // block below), so the clicked target needs a non-zero value.
        valueByRegionId={new Map([[target.id, 1]])}
        maxValue={100}
        selectedRegionId={null}
        onSelect={onSelect}
      />,
    );

    const path = document.querySelector(`path[data-region-id="${target.id}"]`);
    expect(path).not.toBeNull();

    fireEvent.click(path!);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(target.id);
  });

  it("recomputes fitSize against just the drilled-into county's extent (not the whole-Taiwan extent), so its townships occupy far more of the viewBox than the county's single path does at the county tier", () => {
    // 嘉義市 is geographically tiny relative to all of Taiwan (only 2 districts),
    // so at the county tier — where fitSize spans all 22 counties — its path
    // should occupy just a small sliver of the viewBox. If fitSize failed to
    // recompute against the passed-in `features` when drilled in (e.g. some
    // future change reused a fixed whole-Taiwan extent), 嘉義市's township
    // paths would remain just as tiny — this comparison would catch that.
    const countyFeatures = buildCountyFeatures();
    const { container: countyContainer } = render(
      <RegionChoropleth
        features={countyFeatures}
        valueByRegionId={new Map()}
        maxValue={0}
        selectedRegionId={null}
        onSelect={() => {}}
      />,
    );
    const countyPath = countyContainer.querySelector('path[data-region-id="嘉義市"]');
    expect(countyPath).not.toBeNull();
    const countyTierWidth = estimateBBoxWidth([countyPath!.getAttribute('d') ?? '']);

    const townFeatures = buildTownFeatures('嘉義市');
    expect(townFeatures.length).toBe(2);
    const { container: townContainer } = render(
      <RegionChoropleth
        features={townFeatures}
        valueByRegionId={new Map()}
        maxValue={0}
        selectedRegionId={null}
        onSelect={() => {}}
      />,
    );
    const townPaths = Array.from(townContainer.querySelectorAll('path')).map(
      p => p.getAttribute('d') ?? '',
    );
    const townTierWidth = estimateBBoxWidth(townPaths);

    expect(townTierWidth).toBeGreaterThan(countyTierWidth * 5);
  });

  it('produces valid (non-empty, non-NaN) path data for every township of a small/remote drilled-into county (regression guard on fitSize degenerating on tiny extents)', () => {
    const features = buildTownFeatures('連江縣');
    expect(features.length).toBe(4);

    const { container } = render(
      <RegionChoropleth
        features={features}
        valueByRegionId={new Map()}
        maxValue={0}
        selectedRegionId={null}
        onSelect={() => {}}
      />,
    );

    const paths = Array.from(container.querySelectorAll('path'));
    expect(paths).toHaveLength(4);
    for (const path of paths) {
      const d = path.getAttribute('d');
      expect(d).toBeTruthy();
      expect(d).not.toContain('NaN');
    }
  });
});

/**
 * 返回全台總覽（任務 6.3）。
 *
 * design.md「RegionChoropleth（Props Contract）」明確列出的完整 props 集合
 * （`features`/`valueByRegionId`/`maxValue`/`selectedRegionId`/`onSelect`）
 * 並未包含任何「返回總覽」專屬的 prop 或按鈕渲染責任；元件本身也不持有
 * `selectedCounty`/`selectedDistrict` 狀態（那是 `locationMapStore` 的職責，
 * 見「檔案結構規劃」`RegionChoropleth` 一列所述：「資料一律由呼叫端
 * （`LocationMapPage`／`useRegionValueMaps`）算好傳入」；系統流程圖中也只有
 * `Store->Map: 切換為該縣市 districts 特徵集`，並無元件內建的返回互動）。
 * 因此「返回全台總覽」由呼叫端（`LocationMapPage`，任務 9.1 建置範圍）讀取
 * store 後,重新傳入縣市層 `features` 來實現，而非本元件內建按鈕。
 *
 * 這裡驗證的是使該重新傳入生效的必要前提：元件純粹依 `features` prop
 * 重新渲染，新的一組 `features` 會完整取代前一組（不殘留舊層級的 path），
 * 因此呼叫端只需要在「返回」操作時重新傳入縣市層 features，即可正確還原
 * 22 縣市總覽視圖。
 */
describe('RegionChoropleth (returning to the full-Taiwan overview, task 6.3)', () => {
  it('fully restores the 22-county overview when the caller re-renders with county-tier features after a drill-down (no stale township paths remain)', () => {
    const countyFeatures = buildCountyFeatures();
    const townFeatures = buildTownFeatures('台北市');

    const { container, rerender } = render(
      <RegionChoropleth
        features={countyFeatures}
        valueByRegionId={new Map()}
        maxValue={0}
        selectedRegionId={null}
        onSelect={() => {}}
      />,
    );
    expect(container.querySelectorAll('path')).toHaveLength(22);

    // Simulate drilling into 台北市: the caller swaps to the township-tier features.
    rerender(
      <RegionChoropleth
        features={townFeatures}
        valueByRegionId={new Map()}
        maxValue={0}
        selectedRegionId={null}
        onSelect={() => {}}
      />,
    );
    expect(container.querySelectorAll('path')).toHaveLength(townFeatures.length);
    expect(document.querySelector('path[data-region-id="台北市"]')).toBeNull();

    // Simulate "返回全台總覽": the caller swaps `features` back to the county tier.
    rerender(
      <RegionChoropleth
        features={countyFeatures}
        valueByRegionId={new Map()}
        maxValue={0}
        selectedRegionId={null}
        onSelect={() => {}}
      />,
    );
    expect(container.querySelectorAll('path')).toHaveLength(22);
    expect(document.querySelector('path[data-region-id="台北市"]')).not.toBeNull();
    for (const f of townFeatures) {
      expect(document.querySelector(`path[data-region-id="${f.id}"]`)).toBeNull();
    }
  });
});
