import {
  groupJobLocationsByCounty,
  resolveJobLocationCounty,
} from './locationCountyGroups';

export interface CountyChipGroup {
  type: 'county';
  county: string;
  districtIds: string[];
  isFull: boolean;
}

export interface StandaloneChipGroup {
  type: 'standalone';
  location: string;
}

export type LocationChipGroup = CountyChipGroup | StandaloneChipGroup;

// Folds selectedLocations into per-county summary groups ("台北市"
// full/partial) so JobActiveFilters can show one chip per county instead of
// one per district. A county only gets folded when 2+ of its selected
// locations resolve to it -- a single selected location is more useful shown
// by its own name than hidden behind a one-item "部分區" summary. Locations
// that resolve to no county at all (fully unparsable, legacy strings) always
// stay standalone; ones tagged only at the county level (e.g. a bare
// "台北市" location_group row, see locationCountyGroups.ts) resolve to that
// county and are folded in alongside its districts. `locationGroups` supplies
// the full known set per county, used to decide 全區 (everything known is
// selected) vs 部分區 (some but not all).
export function deriveLocationChipGroups(
  selectedLocations: readonly string[],
  locationGroups: readonly { location: string }[],
): LocationChipGroup[] {
  const knownDistrictsByCounty = groupJobLocationsByCounty(locationGroups);

  const selectedByCounty = new Map<string, string[]>();
  const standalone: string[] = [];

  for (const location of selectedLocations) {
    const county = resolveJobLocationCounty(location);
    if (!county) {
      standalone.push(location);
      continue;
    }
    const bucket = selectedByCounty.get(county);
    if (bucket) {
      bucket.push(location);
    } else {
      selectedByCounty.set(county, [location]);
    }
  }

  const groups: LocationChipGroup[] = [];
  for (const [county, districtIds] of selectedByCounty) {
    if (districtIds.length < 2) {
      standalone.push(...districtIds);
      continue;
    }
    const knownTotal = knownDistrictsByCounty.get(county)?.length;
    groups.push({
      type: 'county',
      county,
      districtIds,
      // Unknown total (locationGroups not loaded yet) defaults to "full" so
      // the label doesn't flash "部分區" before data arrives.
      isFull: knownTotal === undefined || districtIds.length >= knownTotal,
    });
  }

  for (const location of standalone) {
    groups.push({ type: 'standalone', location });
  }

  return groups;
}
