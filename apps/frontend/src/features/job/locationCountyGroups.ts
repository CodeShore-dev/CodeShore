import { parseLocationGroupId } from '../location-map/utils/regionId';

// Some job postings are only tagged at the county level, with no district
// (e.g. "台北市" itself, alongside "台北市信義區" etc as separate
// location_group rows). `parseLocationGroupId` deliberately excludes these
// (it requires both a county and a district part), which is correct for
// location-map's own grouping needs but would silently drop this county-only
// data from the job filter's county tab / active-filter grouping. This
// pattern recognizes that bare form so it can be folded into the same county
// bucket instead of being treated as unparsable.
const BARE_COUNTY_PATTERN = /^[一-鿿]+(?:市|縣)$/;

export function isBareCountyLocationId(id: string): boolean {
  return BARE_COUNTY_PATTERN.test(id);
}

// Resolves the county a job location_group id belongs to, for both the
// "<county><district>" form and the bare "<county>" form. Returns null for
// anything else (unparsable/legacy strings), which callers should exclude.
export function resolveJobLocationCounty(id: string): string | null {
  const parsed = parseLocationGroupId(id);
  if (parsed) return parsed.county;
  return isBareCountyLocationId(id) ? id : null;
}

// Job-feature-local county grouping (deliberately not reusing location-map's
// groupByCounty): unlike the map's choropleth, the job filter's "select a
// whole county" and "county summary chip" concepts should also cover jobs
// tagged only at the county level, not just ones with a known district.
// Label for a single location_group id once it's already known to belong to
// a county group (used when expanding a county summary chip into its
// individual members). Bare county-level entries have no district part to
// show, so they get a distinct "未分區" (unspecified district) label instead
// of repeating the county name next to its own siblings.
export function jobLocationDistrictLabel(id: string): string {
  const parsed = parseLocationGroupId(id);
  if (parsed) return parsed.district;
  return isBareCountyLocationId(id) ? '未分區' : id;
}

export function groupJobLocationsByCounty<T extends { location: string }>(
  rows: readonly T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const row of rows) {
    const county = resolveJobLocationCounty(row.location);
    if (!county) continue;

    const bucket = grouped.get(county);
    if (bucket) {
      bucket.push(row);
    } else {
      grouped.set(county, [row]);
    }
  }

  return grouped;
}
