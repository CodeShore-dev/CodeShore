/**
 * 純函式：`taiwan-atlas` 幾何特徵名稱 ↔ `location_group.id` 的比對／正規化工具
 * （task 4.1，design.md「utils/regionId.ts（Pure Function Contract）」）。
 *
 * `parseLocationGroupId` 的判斷邏輯刻意「比照」（mirror）後端
 * `apps/backend/src/features/ai-suggestion/validation/location-format-check.ts`
 * 的 `LOCATION_GROUP_ID_PATTERN`（`/^[一-鿿]+(市|縣)[一-鿿]+(市|鎮|區|鄉)$/`）——
 * 兩邊各自維護一份同構的正規表示式（前端不跨 app 匯入後端原始碼），任一邊
 * 日後調整命名慣例時需同步檢視另一邊（design.md「重新驗證觸發點」）。
 * 這裡另外加上兩個擷取群組以切出 `county`/`district`。
 */
export interface ParsedRegionId {
  county: string;
  district: string;
}

const LOCATION_GROUP_ID_SPLIT_PATTERN =
  /^([一-鿿]+(?:市|縣))([一-鿿]+(?:市|鎮|區|鄉))$/;

/**
 * 解析 `location_group.id`（`"<縣市全名><鄉鎮市區全名>"`，無分隔符）。
 * 不符合既有 `LOCATION_GROUP_ID_PATTERN` 格式者（例如缺少縣市前綴的裸地區
 * 名、非標準的舊式字串）回傳 `null`，呼叫端須據此略過該筆資料而非拋錯
 * （Requirement 7.2：未對應/格式不符的資料排除不計）。
 */
export function parseLocationGroupId(id: string): ParsedRegionId | null {
  const match = LOCATION_GROUP_ID_SPLIT_PATTERN.exec(id);
  if (!match) {
    return null;
  }

  const [, county, district] = match;
  return { county, district };
}

/**
 * `taiwan-atlas` 的 `COUNTYNAME` 使用正體「臺」字，`location_group.id` 慣例
 * 使用「台」；僅正規化四個已知使用「臺」的縣市（臺北市／臺中市／臺南市／
 * 臺東縣）在字串開頭處的這個單一已知差異，不做其他猜測性字串轉換。
 */
const TAI_TO_TAI_COUNTY_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ['臺北市', '台北市'],
  ['臺中市', '台中市'],
  ['臺南市', '台南市'],
  ['臺東縣', '台東縣'],
];

export function normalizeCountyName(name: string): string {
  for (const [taiPrefix, taiPrefixNormalized] of TAI_TO_TAI_COUNTY_PREFIXES) {
    if (name.startsWith(taiPrefix)) {
      return taiPrefixNormalized + name.slice(taiPrefix.length);
    }
  }
  return name;
}

/**
 * 將 `taiwan-atlas` feature 的 `COUNTYNAME`（+ `TOWNNAME`）轉換為可與
 * `location_group.id` 直接比對的字串鍵。
 */
export function toRegionKey(county: string, district?: string): string {
  return `${normalizeCountyName(county)}${district ?? ''}`;
}

/**
 * 將任一帶有 `location`（`location_group.id` 形狀）欄位的資料列依解析出的
 * 縣市分組；解析失敗（`parseLocationGroupId` 回傳 `null`）的資料列不進入
 * 任何分組，對應 Requirement 7.2 的排除不計規則。這是 `useRegionValueMaps`
 * （縣市層加總）與 `RegionDetailPanel`（縣市層級跳轉取得旗下 location_group
 * id 清單）共用的單一分組實作。
 */
export function groupByCounty<T extends { location: string }>(
  rows: readonly T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const row of rows) {
    const parsed = parseLocationGroupId(row.location);
    if (!parsed) {
      continue;
    }

    const bucket = grouped.get(parsed.county);
    if (bucket) {
      bucket.push(row);
    } else {
      grouped.set(parsed.county, [row]);
    }
  }

  return grouped;
}
