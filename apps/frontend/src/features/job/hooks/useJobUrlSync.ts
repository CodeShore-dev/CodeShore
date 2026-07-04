import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';

import { useKeywordFilterStore } from '../../keyword/keywordFilterStore';
import { useJobFilterStore } from '../jobFilterStore';

function salaryMultiplier(type: 'month' | 'year' | ''): number {
  if (type === 'year') return 1_000_000;
  if (type === 'month') return 10_000;
  return 1;
}

// Bidirectional sync between the job/keyword filter stores and the URL query
// (task 7.3, requirements 3.2, 1.4). Ported from useJobUrlSync.ts.
//   - mount: parse the query into the stores (once)
//   - state -> URL: write a normalized query (replace), skipping the first run
//     so the parsed params are not wiped before the parsed state commits
//   - URL -> state: keep selectedJobId in sync on back/forward
export function useJobUrlSync() {
  const [searchParams, setSearchParams] = useSearchParams();
  const firstSync = useRef(true);

  // mount: URL -> stores. Read the router's params (captured at mount).
  useEffect(() => {
    const q = searchParams;
    const job = useJobFilterStore.getState();
    const kw = useKeywordFilterStore.getState();

    const tags = q.get('tags');
    if (tags) kw.setSelectedTags(tags.split(','));
    const notTags = q.get('notTags');
    if (notTags) kw.setExcludedTags(notTags.split(','));
    if (q.get('op') === 'or') kw.setOperator('or');

    const salary = q.get('salary');
    if (salary === 'excluding' || salary === 'only') {
      job.setSalaryFilter(salary);
    }
    const salaryTypeRaw = q.get('salaryType');
    const amtType =
      salaryTypeRaw === 'month' || salaryTypeRaw === 'year'
        ? salaryTypeRaw
        : '';
    const search = q.get('search');
    if (search) job.setSearchText(search);
    const salaryAmt = q.get('salaryAmt');
    let amount: number | null = null;
    if (salaryAmt) {
      const n = Number(salaryAmt);
      if (!Number.isNaN(n)) amount = n * salaryMultiplier(amtType);
    }
    if (amtType || amount !== null) {
      job.setSalaryAmount({ type: amtType, amount });
    }
    const locations = q.get('locations');
    if (locations) job.setSelectedLocations(locations.split(','));
    const companies = q.get('companies');
    const notCompanies = q.get('notCompanies');
    if (companies || notCompanies) {
      const includeEntries = companies
        ? companies
            .split(',')
            .map(name => ({ name, mode: 'include' as const }))
        : [];
      const excludeEntries = notCompanies
        ? notCompanies
            .split(',')
            .map(name => ({ name, mode: 'exclude' as const }))
        : [];
      useJobFilterStore.setState({
        companyFilters: [...includeEntries, ...excludeEntries],
      });
    }
    const tab = q.get('tab');
    if (tab === 'like' || tab === 'dislike') {
      job.setListViewPreference(tab);
    }
    const pageRaw = q.get('page');
    const page = pageRaw ? Number(pageRaw) || 1 : 1;
    if (page > 1) job.setPage(page);
    const jobId = q.get('jobId');
    if (jobId) job.setSelectedJobId(jobId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedTags = useKeywordFilterStore(s => s.selectedTags);
  const excludedTags = useKeywordFilterStore(s => s.excludedTags);
  const operator = useKeywordFilterStore(s => s.keywordOperator);
  const salaryFilter = useJobFilterStore(s => s.salaryFilter);
  const salaryAmount = useJobFilterStore(s => s.salaryAmount);
  const searchText = useJobFilterStore(s => s.searchText);
  const companyFilters = useJobFilterStore(s => s.companyFilters);
  const selectedLocations = useJobFilterStore(s => s.selectedLocations);
  const listViewPreference = useJobFilterStore(s => s.listViewPreference);
  const page = useJobFilterStore(s => s.page);
  const selectedJobId = useJobFilterStore(s => s.selectedJobId);

  // state -> URL
  useEffect(() => {
    if (firstSync.current) {
      firstSync.current = false;
      return;
    }
    const next = new URLSearchParams();
    if (selectedTags.length) next.set('tags', selectedTags.join(','));
    if (excludedTags.length) next.set('notTags', excludedTags.join(','));
    if (operator !== 'and') next.set('op', operator);
    if (salaryFilter !== 'none') next.set('salary', salaryFilter);
    if (salaryAmount.type) next.set('salaryType', salaryAmount.type);
    const mult = salaryMultiplier(salaryAmount.type);
    const rawAmt =
      salaryAmount.amount !== null && mult
        ? salaryAmount.amount / mult
        : null;
    if (rawAmt !== null) next.set('salaryAmt', String(rawAmt));
    if (searchText) next.set('search', searchText);
    if (selectedLocations.length) {
      next.set('locations', selectedLocations.join(','));
    }
    const includeNames = companyFilters
      .filter(entry => entry.mode === 'include')
      .map(entry => entry.name);
    const excludeNames = companyFilters
      .filter(entry => entry.mode === 'exclude')
      .map(entry => entry.name);
    if (includeNames.length) next.set('companies', includeNames.join(','));
    if (excludeNames.length) next.set('notCompanies', excludeNames.join(','));
    if (listViewPreference) next.set('tab', listViewPreference);
    if (page > 1) next.set('page', String(page));
    if (selectedJobId) next.set('jobId', selectedJobId);
    setSearchParams(next, { replace: true });
  }, [
    selectedTags,
    excludedTags,
    operator,
    salaryFilter,
    salaryAmount,
    searchText,
    companyFilters,
    selectedLocations,
    listViewPreference,
    page,
    selectedJobId,
    setSearchParams,
  ]);

  // URL -> selectedJobId (back/forward)
  useEffect(() => {
    const jobId = searchParams.get('jobId');
    useJobFilterStore.getState().setSelectedJobId(jobId || null);
  }, [searchParams]);

  return { selectedJobId };
}
