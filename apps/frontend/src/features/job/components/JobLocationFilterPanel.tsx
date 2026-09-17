import { useMemo, useState } from 'react';

import { useJobFilterStore } from '../jobFilterStore';
import { groupJobLocationsByCounty } from '../locationCountyGroups';
import { useLocationGroupsQuery } from '../queries';

type LocationTab = 'ranking' | 'county';

const LOCATION_TABS: { value: LocationTab; label: string }[] = [
  { value: 'county', label: '縣市' },
  { value: 'ranking', label: '地區排名' },
];

// Location filter section, extracted from JobFilterSidebar to keep that file
// under the 200-line component limit. Self-contained: reads/writes the job
// filter store directly, mirroring JobTechFilterPanel's no-props pattern.
export function JobLocationFilterPanel() {
  const selectedLocations = useJobFilterStore(s => s.selectedLocations);
  const setSelectedLocations = useJobFilterStore(s => s.setSelectedLocations);

  const { data: locationGroups = [], isLoading: locationGroupsLoading } =
    useLocationGroupsQuery();

  const [activeTab, setActiveTab] = useState<LocationTab>('county');
  const [locationSearch, setLocationSearch] = useState('');

  const filteredLocationGroups = (() => {
    const q = locationSearch.trim().toLowerCase();
    if (!q) return locationGroups;
    return locationGroups.filter(loc => loc.location.toLowerCase().includes(q));
  })();

  // County tab: groups every location_group row under its county, including
  // rows tagged only at the county level (e.g. a bare "台北市" posting with
  // no specific district -- see locationCountyGroups.ts), then sums job
  // counts per county for the same count-desc ranking feel as the flat list.
  const countyGroups = useMemo(() => {
    const grouped = groupJobLocationsByCounty(locationGroups);
    return Array.from(grouped.entries())
      .map(([county, rows]) => ({
        county,
        districtIds: rows.map(row => row.location),
        count: rows.reduce((sum, row) => sum + row.count, 0),
      }))
      .sort((a, b) => b.count - a.count);
  }, [locationGroups]);

  const filteredCountyGroups = (() => {
    const q = locationSearch.trim().toLowerCase();
    if (!q) return countyGroups;
    return countyGroups.filter(c => c.county.toLowerCase().includes(q));
  })();

  const toggleLocation = (location: string) => {
    setSelectedLocations(
      selectedLocations.includes(location)
        ? selectedLocations.filter(l => l !== location)
        : [...selectedLocations, location],
    );
  };

  // Selecting a county always acts on its full set of districts at once
  // (add all if any are missing, remove all if every district is already
  // selected) rather than letting users pick individual districts here.
  const toggleCounty = (districtIds: string[]) => {
    const allSelected = districtIds.every(id =>
      selectedLocations.includes(id),
    );
    setSelectedLocations(
      allSelected
        ? selectedLocations.filter(l => !districtIds.includes(l))
        : Array.from(new Set([...selectedLocations, ...districtIds])),
    );
  };

  return (
    <section>
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-[0.15em] text-[#434653]">
        <span>地區</span>
        {selectedLocations.length > 0 && (
          <span className="rounded-full bg-[#003d92] px-1.5 py-px text-[9px] leading-none text-white">
            {selectedLocations.length}
          </span>
        )}
      </div>
      <div className="border-surface-container-highest mb-3 flex overflow-hidden rounded border">
        {LOCATION_TABS.map(tab => (
          <button
            key={tab.value}
            type="button"
            className={`flex-1 cursor-pointer px-2 py-1 text-sm font-bold transition-colors ${
              activeTab === tab.value
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="relative mb-3">
        <span className="material-symbols-outlined text-on-surface-variant pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base!">
          search
        </span>
        <input
          value={locationSearch}
          type="text"
          placeholder={activeTab === 'ranking' ? '搜尋地區...' : '搜尋縣市...'}
          className="border-surface-container-highest text-on-surface placeholder-on-surface-variant/50 bg-surface-container w-full rounded-lg border py-2 pr-8 pl-9 text-sm font-bold focus:outline-none"
          onChange={e => setLocationSearch(e.target.value)}
        />
        {locationSearch && (
          <button
            type="button"
            className="text-on-surface-variant hover:text-on-surface absolute top-1/2 right-2 flex -translate-y-1/2 cursor-pointer"
            onClick={() => setLocationSearch('')}
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        )}
      </div>
      {locationGroupsLoading ? (
        <div className="text-on-surface-variant text-xs">載入中...</div>
      ) : activeTab === 'ranking' ? (
        <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
          {filteredLocationGroups.map(loc => (
            <span
              key={loc.location}
              className={`flex w-full cursor-pointer items-center justify-between rounded px-4 py-2 text-sm font-bold ${
                selectedLocations.includes(loc.location)
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant hover:bg-primary-container hover:text-on-primary'
              }`}
              onClick={() => toggleLocation(loc.location)}
            >
              <span>{loc.location}</span>
              <span className="flex items-center gap-1">
                {selectedLocations.includes(loc.location) && (
                  <span className="material-symbols-outlined text-sm">check</span>
                )}
                <span>{loc.count}</span>
              </span>
            </span>
          ))}
          {!filteredLocationGroups.length && locationSearch && (
            <span className="text-on-surface-variant px-4 py-2 text-sm">
              沒有符合的地區
            </span>
          )}
        </div>
      ) : (
        <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
          {filteredCountyGroups.map(group => {
            const isFullySelected = group.districtIds.every(id =>
              selectedLocations.includes(id),
            );
            return (
              <span
                key={group.county}
                className={`flex w-full cursor-pointer items-center justify-between rounded px-4 py-2 text-sm font-bold ${
                  isFullySelected
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface-variant hover:bg-primary-container hover:text-on-primary'
                }`}
                onClick={() => toggleCounty(group.districtIds)}
              >
                <span>{group.county}</span>
                <span className="flex items-center gap-1">
                  {isFullySelected && (
                    <span className="material-symbols-outlined text-sm">
                      check
                    </span>
                  )}
                  <span>{group.count}</span>
                </span>
              </span>
            );
          })}
          {!filteredCountyGroups.length && locationSearch && (
            <span className="text-on-surface-variant px-4 py-2 text-sm">
              沒有符合的縣市
            </span>
          )}
        </div>
      )}
    </section>
  );
}
