/**
 * 對 `taiwan-atlas` 這個第三方 vendored TopoJSON 資料集的最小型別化包裝層。
 *
 * `taiwan-atlas` 沒有提供聚合的 JS 進入點（package.json 只有 `main`/`jsnext:main`
 * 指向 mercator 投影工具，實際地理資料是直接以 `*.json` 檔案隨套件發佈），因此
 * 這裡以 subpath 匯入對應的 TopoJSON 檔案，並用 `resolveJsonModule` 推斷出的
 * 字面型別轉型為 `topojson-specification` 的 `Topology` 型別後再暴露出去。
 *
 * 重要澄清（已用真實套件內容核實，design.md 的假設有誤）：
 * `districts-10t.json` 的 `districts` 物件是「立法委員選區」（74 筆，屬性只有
 * COUNTYNAME/COUNTYID/COUNTYCODE/COUNTYENG/DISTRICTCODE，沒有 TOWNNAME），
 * 並不是縣市＋鄉鎮市區雙層所需的「鄉鎮市區」層級資料。真正對應鄉鎮市區
 * （368 筆、含 TOWNNAME）的資料集是 `towns-10t.json` 的 `towns` 物件。
 * 本檔案同時暴露兩者的型別化存取函式，供 `taiwanAtlas.spec.ts` 以實際轉換
 * 結果驗證此差異；後續下鑽鄉鎮市區的元件應使用 `getTownsFeatureCollection`
 * （而非 `districts-10t`）。
 */
import { feature } from 'topojson-client';
import type {
  GeometryCollection,
  Topology,
} from 'topojson-specification';
import type {
  FeatureCollection,
  MultiPolygon,
  Polygon,
} from 'geojson';

import countiesTopologyJson from 'taiwan-atlas/counties-10t.json';
import districtsTopologyJson from 'taiwan-atlas/districts-10t.json';
import townsTopologyJson from 'taiwan-atlas/towns-10t.json';

export interface CountyProperties {
  COUNTYNAME: string;
  COUNTYENG: string;
  COUNTYID: string;
  COUNTYCODE: string;
}

export interface TownProperties extends CountyProperties {
  TOWNNAME: string;
  TOWNENG: string;
  TOWNID: string;
  TOWNCODE: string;
}

export interface LegislativeDistrictProperties {
  COUNTYNAME: string;
  COUNTYID: string;
  COUNTYCODE: string;
  COUNTYENG: string;
  DISTRICTCODE: string;
}

export const countiesTopology = countiesTopologyJson as unknown as Topology;
export const districtsTopology = districtsTopologyJson as unknown as Topology;
export const townsTopology = townsTopologyJson as unknown as Topology;

/** 縣市層級（22 筆）GeoJSON FeatureCollection。 */
export function getCountiesFeatureCollection(): FeatureCollection<
  Polygon | MultiPolygon,
  CountyProperties
> {
  return feature(
    countiesTopology,
    countiesTopology.objects.counties as GeometryCollection<CountyProperties>,
  ) as FeatureCollection<Polygon | MultiPolygon, CountyProperties>;
}

/**
 * 鄉鎮市區層級（368 筆，含 TOWNNAME）GeoJSON FeatureCollection。
 * 這是本 feature 實際應使用的鄉鎮市區資料來源。
 */
export function getTownsFeatureCollection(): FeatureCollection<
  Polygon | MultiPolygon,
  TownProperties
> {
  return feature(
    townsTopology,
    townsTopology.objects.towns as GeometryCollection<TownProperties>,
  ) as FeatureCollection<Polygon | MultiPolygon, TownProperties>;
}

/**
 * `districts-10t` 的立法委員選區層級（74 筆）GeoJSON FeatureCollection。
 * 僅供驗證/紀錄用途——本 feature 的鄉鎮市區下鑽不使用此資料集。
 */
export function getLegislativeDistrictsFeatureCollection(): FeatureCollection<
  Polygon | MultiPolygon,
  LegislativeDistrictProperties
> {
  return feature(
    districtsTopology,
    districtsTopology.objects.districts as GeometryCollection<LegislativeDistrictProperties>,
  ) as FeatureCollection<Polygon | MultiPolygon, LegislativeDistrictProperties>;
}
