/**
 * Taiwan's official administrative-region naming pattern that every new
 * `location_group.id` must follow: a full 縣市 name immediately followed by a
 * full 鄉鎮市區 name, e.g. "台北市信義區", "新竹縣竹北市" -- never an English
 * slug or a partial name. `location_group` has no separate display-label
 * column (`LocationGroupService`: "location_group has a single column
 * (id)"), so the id itself is the canonical, human-readable name.
 */
export const LOCATION_GROUP_ID_PATTERN =
  /^[一-鿿]+(市|縣)[一-鿿]+(市|鎮|區|鄉)$/;

export function isStandardLocationGroupFormat(id: string): boolean {
  return LOCATION_GROUP_ID_PATTERN.test(id);
}
