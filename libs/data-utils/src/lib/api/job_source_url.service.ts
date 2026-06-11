import { SupabaseTable } from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { getSupabaseClient } from '@codeshore/supabase';

import { TableService } from '../shared-services/supabase/table.service';
import { deleteAll } from '../shared-services/supabase/utils';

export class JobSourceURLService extends TableService<SupabaseTable.JobSourceURL> {
  constructor(logger?: ServiceLogger) {
    super(getSupabaseClient(), 'job_source_url', logger);
  }

  clearAll() {
    return deleteAll(
      getSupabaseClient().from('job_source_url'),
      'url',
    );
  }
}

const _removePageIndexFromURL = (url: string) => {
  const urlObject = new URL(url);
  urlObject.searchParams.delete('page');
  return urlObject.toString();
};

export async function resetJobSourceURLs(
  jobSourceURLs: SupabaseTable.JobSourceURL[],
) {
  const supabase = getSupabaseClient();
  return deleteAll(
    supabase.from('job_source_url'),
    'url',
  ).then(() =>
    supabase.from('job_source_url').upsert(jobSourceURLs),
  );
}

export async function upsertJobSourceURL(
  url: string,
  page_index: number,
  status: string,
) {
  return getSupabaseClient()
    .from('job_source_url')
    .upsert({
      url: _removePageIndexFromURL(url),
      page_index,
      status,
    });
}

export async function createJobSourceURLs(
  url: string,
  totalPages: number,
  startFromPageIndex = 2,
) {
  return getSupabaseClient()
    .from('job_source_url')
    .upsert(
      Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter(x => x >= startFromPageIndex)
        .map(page_index => ({
          url: _removePageIndexFromURL(url),
          page_index,
          status: 'pending',
        })),
    );
}
