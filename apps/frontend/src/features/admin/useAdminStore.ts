import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';

import {
  AnomalyJob,
  CrawlParams,
  CrawlStats,
  LocationAnomalyType,
  UpdateDateCount,
  createAdminCrawlEventSource,
  fetchCrawlStats,
  fetchEmptyDescriptionJobs,
  fetchLocationAnomalies,
  fetchSalaryAnomalies,
  fetchUpdateDateCounts,
  updateJobSalary,
} from './service';

const PAGE_SIZE = 20;

type Section = {
  items: AnomalyJob[];
  count: number;
  page: number;
  loading: boolean;
};

const newSection = (): Section => ({
  items: [],
  count: 0,
  page: 1,
  loading: false,
});

export const useAdminStore = defineStore('admin', () => {
  const stats = ref<CrawlStats | null>(null);
  const statsLoading = ref(false);

  const salary = reactive(newSection());
  const location = reactive(newSection());
  const emptyDescription = reactive(newSection());

  const salaryThreshold = reactive({
    monthCeil: 300000,
    yearCeil: 9999999,
  });
  const locationType = ref<LocationAnomalyType>('unmapped');
  const locationMaxLen = ref(30);
  const statsDays = ref(7);

  const updateDateCounts = ref<UpdateDateCount[]>([]);
  const updateDatesLoading = ref(false);
  const selectedDates = ref<string[]>([]);

  const crawlRunning = ref(false);
  const crawlDone = ref(false);
  const crawlLabel = ref('');
  const crawlProgress = ref<string[]>([]);
  let eventSource: EventSource | null = null;

  const range = (page: number) => {
    const from = (page - 1) * PAGE_SIZE;
    return { from, to: from + PAGE_SIZE - 1 };
  };

  const loadStats = async () => {
    try {
      statsLoading.value = true;
      stats.value = await fetchCrawlStats(statsDays.value);
    } finally {
      statsLoading.value = false;
    }
  };

  const applyStatsDays = (days: number) => {
    statsDays.value = days;
    return loadStats();
  };

  const loadSalary = async (page = salary.page) => {
    salary.loading = true;
    try {
      const { from, to } = range(page);
      const { result, count } = await fetchSalaryAnomalies({
        from,
        to,
        monthCeil: salaryThreshold.monthCeil,
        yearCeil: salaryThreshold.yearCeil,
      });
      salary.items = result;
      salary.count = count;
      salary.page = page;
    } finally {
      salary.loading = false;
    }
  };

  const loadLocation = async (page = location.page) => {
    location.loading = true;
    try {
      const { from, to } = range(page);
      const { result, count } =
        await fetchLocationAnomalies({
          from,
          to,
          type: locationType.value,
          maxLen: locationMaxLen.value,
        });
      location.items = result;
      location.count = count;
      location.page = page;
    } finally {
      location.loading = false;
    }
  };

  const loadEmptyDescription = async (
    page = emptyDescription.page,
  ) => {
    emptyDescription.loading = true;
    try {
      const { from, to } = range(page);
      const { result, count } =
        await fetchEmptyDescriptionJobs({ from, to });
      emptyDescription.items = result;
      emptyDescription.count = count;
      emptyDescription.page = page;
    } finally {
      emptyDescription.loading = false;
    }
  };

  const loadUpdateDateCounts = async () => {
    updateDatesLoading.value = true;
    try {
      updateDateCounts.value = await fetchUpdateDateCounts();
      // Drop selections for dates that no longer exist.
      const valid = new Set(
        updateDateCounts.value.map(d => d.updated_date),
      );
      selectedDates.value = selectedDates.value.filter(d =>
        valid.has(d),
      );
    } finally {
      updateDatesLoading.value = false;
    }
  };

  const toggleDate = (date: string) => {
    const i = selectedDates.value.indexOf(date);
    if (i >= 0) selectedDates.value.splice(i, 1);
    else selectedDates.value.push(date);
  };

  const toggleAllDates = () => {
    if (
      selectedDates.value.length ===
      updateDateCounts.value.length
    ) {
      selectedDates.value = [];
    } else {
      selectedDates.value = updateDateCounts.value.map(
        d => d.updated_date,
      );
    }
  };

  const recrawlSelectedDates = () => {
    if (!selectedDates.value.length) return;
    startCrawl(
      {
        mode: 'recrawl-dates',
        dates: [...selectedDates.value],
      },
      `重抓更新日期：${selectedDates.value.join('、')}`,
    );
  };

  // ---- Unmapped-location grouping + selection ----
  const UNMAPPED_GROUP_THRESHOLD = 10;
  const BELOW_KEY = '__below__';

  const unmappedJobs = ref<AnomalyJob[]>([]);
  const unmappedLoading = ref(false);
  const selectedLocationGroups = ref<string[]>([]);

  type LocationGroupRow = {
    key: string;
    location: string;
    count: number;
    jobs: AnomalyJob[];
  };

  const locationGroupRows = computed<LocationGroupRow[]>(
    () => {
      const map = new Map<string, AnomalyJob[]>();
      for (const j of unmappedJobs.value) {
        const loc = j.location ?? '';
        if (!map.has(loc)) map.set(loc, []);
        map.get(loc)!.push(j);
      }
      const groups = [...map.entries()]
        .map(([location, jobs]) => ({
          location,
          jobs,
          count: jobs.length,
        }))
        .sort((a, b) => b.count - a.count);

      const rows: LocationGroupRow[] = groups
        .filter(g => g.count >= UNMAPPED_GROUP_THRESHOLD)
        .map(g => ({
          key: g.location,
          location: g.location || '（空字串）',
          count: g.count,
          jobs: g.jobs,
        }));

      const small = groups.filter(
        g => g.count < UNMAPPED_GROUP_THRESHOLD,
      );
      if (small.length) {
        const jobs = small.flatMap(g => g.jobs);
        rows.push({
          key: BELOW_KEY,
          location: `其他（每個地點 < ${UNMAPPED_GROUP_THRESHOLD}，共 ${small.length} 個地點）`,
          count: jobs.length,
          jobs,
        });
      }
      return rows;
    },
  );

  const loadUnmappedJobs = async () => {
    unmappedLoading.value = true;
    try {
      const { result } = await fetchLocationAnomalies({
        from: 0,
        to: -1,
        type: 'unmapped',
        maxLen: locationMaxLen.value,
      });
      unmappedJobs.value = result;
      const keys = new Set(
        locationGroupRows.value.map(g => g.key),
      );
      selectedLocationGroups.value =
        selectedLocationGroups.value.filter(k =>
          keys.has(k),
        );
    } finally {
      unmappedLoading.value = false;
    }
  };

  const toggleLocationGroup = (key: string) => {
    const i = selectedLocationGroups.value.indexOf(key);
    if (i >= 0) selectedLocationGroups.value.splice(i, 1);
    else selectedLocationGroups.value.push(key);
  };

  const toggleAllLocationGroups = () => {
    if (
      selectedLocationGroups.value.length ===
      locationGroupRows.value.length
    ) {
      selectedLocationGroups.value = [];
    } else {
      selectedLocationGroups.value =
        locationGroupRows.value.map(g => g.key);
    }
  };

  const recrawlSelectedLocationGroups = () => {
    const sel = new Set(selectedLocationGroups.value);
    const ids = locationGroupRows.value
      .filter(g => sel.has(g.key))
      .flatMap(g => g.jobs.map(j => j.id));
    if (!ids.length) return;
    startCrawl(
      { mode: 'recrawl-ids', ids },
      `重抓未歸類地點：${sel.size} 組 / ${ids.length} 筆`,
    );
  };

  const init = async () => {
    await Promise.all([
      loadStats(),
      loadSalary(1),
      loadUnmappedJobs(),
      loadEmptyDescription(1),
      loadUpdateDateCounts(),
    ]);
  };

  const saveSalary = async (
    id: string,
    min: number,
    max: number,
    type: 'month' | 'year',
  ) => {
    salary.loading = true;
    try {
      await updateJobSalary(id, min, max, type);
    } finally {
      salary.loading = false;
    }
    await loadSalary();
  };

  const applySalaryThreshold = (
    monthCeil: number,
    yearCeil: number,
  ) => {
    salaryThreshold.monthCeil = monthCeil;
    salaryThreshold.yearCeil = yearCeil;
    return loadSalary(1);
  };

  const setLocationType = (type: LocationAnomalyType) => {
    locationType.value = type;
    return loadLocation(1);
  };

  const applyLocationMaxLen = (maxLen: number) => {
    locationMaxLen.value = maxLen;
    return loadLocation(1);
  };

  const refreshAfterCrawl = () =>
    Promise.all([
      loadStats(),
      loadSalary(),
      loadUnmappedJobs(),
      loadEmptyDescription(),
      loadUpdateDateCounts(),
    ]);

  const startCrawl = (
    params: CrawlParams,
    label: string,
  ) => {
    if (crawlRunning.value) return;
    crawlRunning.value = true;
    crawlDone.value = false;
    crawlLabel.value = label;
    crawlProgress.value = [];

    eventSource?.close();
    const es = createAdminCrawlEventSource(params);
    eventSource = es;

    es.onmessage = event => {
      try {
        const { data } = JSON.parse(event.data) ?? {};
        if (data.type === 'log') {
          crawlProgress.value.push(data.message);
        } else if (
          data.type === 'done' ||
          data.type === 'error'
        ) {
          if (data.type === 'error' && data.message) {
            crawlProgress.value.push(`[error] ${data.message}`);
          }
          crawlDone.value = true;
          crawlRunning.value = false;
          es.close();
          if (data.success) refreshAfterCrawl();
        }
      } catch (error) {
        console.error(error);
      }
    };

    es.onerror = () => {
      crawlDone.value = true;
      crawlRunning.value = false;
      es.close();
    };
  };

  const clearCrawlLog = () => {
    crawlProgress.value = [];
    crawlDone.value = false;
    crawlLabel.value = '';
  };

  return {
    stats,
    statsLoading,
    salary,
    location,
    emptyDescription,
    salaryThreshold,
    locationType,
    locationMaxLen,
    statsDays,
    updateDateCounts,
    updateDatesLoading,
    selectedDates,
    unmappedLoading,
    locationGroupRows,
    selectedLocationGroups,
    crawlRunning,
    crawlDone,
    crawlLabel,
    crawlProgress,
    pageSize: PAGE_SIZE,
    init,
    loadSalary,
    loadLocation,
    loadEmptyDescription,
    saveSalary,
    applySalaryThreshold,
    setLocationType,
    applyLocationMaxLen,
    applyStatsDays,
    loadUpdateDateCounts,
    toggleDate,
    toggleAllDates,
    recrawlSelectedDates,
    loadUnmappedJobs,
    toggleLocationGroup,
    toggleAllLocationGroups,
    recrawlSelectedLocationGroups,
    startCrawl,
    clearCrawlLog,
  };
});
