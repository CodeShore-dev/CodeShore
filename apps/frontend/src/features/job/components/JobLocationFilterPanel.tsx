import { useState } from 'react';

import { useJobFilterStore } from '../jobFilterStore';
import { useLocationGroupsQuery } from '../queries';

// Location filter section, extracted from JobFilterSidebar to keep that file
// under the 200-line component limit. Self-contained: reads/writes the job
// filter store directly, mirroring JobTechFilterPanel's no-props pattern.
export function JobLocationFilterPanel() {
  const selectedLocations = useJobFilterStore(s => s.selectedLocations);
  const setSelectedLocations = useJobFilterStore(s => s.setSelectedLocations);

  const { data: locationGroups = [], isLoading: locationGroupsLoading } =
    useLocationGroupsQuery();

  const [locationSearch, setLocationSearch] = useState('');
  const filteredLocationGroups = (() => {
    const q = locationSearch.trim().toLowerCase();
    if (!q) return locationGroups;
    return locationGroups.filter(loc => loc.location.toLowerCase().includes(q));
  })();

  const toggleLocation = (location: string) => {
    setSelectedLocations(
      selectedLocations.includes(location)
        ? selectedLocations.filter(l => l !== location)
        : [...selectedLocations, location],
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
      <div className="relative mb-3">
        <span className="material-symbols-outlined text-on-surface-variant pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base!">
          search
        </span>
        <input
          value={locationSearch}
          type="text"
          placeholder="搜尋地區..."
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
      ) : (
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
      )}
    </section>
  );
}
