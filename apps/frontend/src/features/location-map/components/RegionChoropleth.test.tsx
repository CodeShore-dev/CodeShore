import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getRegionColor } from '../utils/colorScale';
import { normalizeCountyName } from '../utils/regionId';
import { getCountiesFeatureCollection } from '../utils/taiwanAtlasData';
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
        valueByRegionId={new Map()}
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
