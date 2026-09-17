import {
  getCountiesFeatureCollection,
  getLegislativeDistrictsFeatureCollection,
  getTownsFeatureCollection,
} from './taiwanAtlasData';

describe('taiwan-atlas dependency load', () => {
  it('converts counties-10t to a GeoJSON FeatureCollection with all 22 counties', () => {
    const collection = getCountiesFeatureCollection();

    expect(collection.type).toBe('FeatureCollection');
    expect(collection.features).toHaveLength(22);
    expect(
      collection.features.every(f => typeof f.properties?.COUNTYNAME === 'string' && f.properties.COUNTYNAME.length > 0),
    ).toBe(true);
  });

  it('converts towns-10t to a GeoJSON FeatureCollection with all 368 townships (the actual 縣市+鄉鎮市區 grain)', () => {
    const collection = getTownsFeatureCollection();

    expect(collection.type).toBe('FeatureCollection');
    expect(collection.features).toHaveLength(368);
    expect(
      collection.features.every(f => typeof f.properties?.TOWNNAME === 'string' && f.properties.TOWNNAME.length > 0),
    ).toBe(true);
    expect(
      collection.features.every(f => typeof f.properties?.COUNTYNAME === 'string' && f.properties.COUNTYNAME.length > 0),
    ).toBe(true);
  });

  // `districts-10t` 在 design.md 中被假設為「縣市+鄉鎮市區」層級（~368 筆），但實際
  // 內容是立法委員選區（74 筆，且各筆粒度不一致——有的對應整個縣市、有的對應單一
  // 鄉鎮市區、有的甚至細到單一村里，屬性欄位隨粒度不同而異）。以下測試以真實轉換
  // 結果核實「筆數遠少於 368」這個關鍵差異，讓後續任務（6.1/6.3 等）不會誤用
  // `districts-10t` 作為鄉鎮市區下鑽的資料來源。
  it('confirms districts-10t is legislative-district grain (74 features) — not the 368-feature township tier', () => {
    const collection = getLegislativeDistrictsFeatureCollection();

    expect(collection.type).toBe('FeatureCollection');
    expect(collection.features).toHaveLength(74);
    expect(collection.features.length).not.toBe(368);
  });
});
