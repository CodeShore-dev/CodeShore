import {
  ListQuery,
  SupabaseTable,
} from '@codeshore/data-types';
import { getSupabaseClient } from '@codeshore/supabase';

import { fetchList } from './utils';

export async function fetchJobSourceURLs(query: ListQuery) {
  const supabase = getSupabaseClient();
  const builder = supabase
    .from('job_source_url')
    .select('*', { count: 'exact' })
    .order('url')
    .order('page_index');

  return fetchList<SupabaseTable.JobSourceURL>(
    builder,
    query,
  ).then(x => ({
    ...x,
    result: x.result.map(y => ({
      ...y,
      host: new URL(y.url).host,
    })),
  }));
}

export async function resetJobSourceURLs(
  jobSourceURLs: SupabaseTable.JobSourceURL[],
) {
  const supabase = getSupabaseClient();
  const { error: deleteError } = await supabase
    .from('job_source_url')
    .delete()
    .neq('url', '');

  if (deleteError) {
    console.error(
      '[Supabase:resetJobSourceURLs] Error deleting job source URLs:',
      deleteError,
    );
  } else {
    console.log(
      `[Supabase:resetJobSourceURLs] Successfully deleted job source URLs.`,
    );
  }

  const { error } = await supabase
    .from('job_source_url')
    .upsert(jobSourceURLs);

  if (error) {
    console.error(
      '[Supabase:resetJobSourceURLs] Error inserting job source URLs  :',
      error,
    );
  } else {
    console.log(
      `[Supabase:resetJobSourceURLs] Successfully inserted ${jobSourceURLs.length} job source URLs.`,
    );
  }
}

export async function updateJobSourceURL(
  url: string,
  page_index: number,
  status: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const urlObject = new URL(url);
  urlObject.searchParams.delete('page');
  const urlWithoutPageIndex = urlObject.toString();
  const { error } = await supabase
    .from('job_source_url')
    .upsert({ url: urlWithoutPageIndex, page_index, status });

  if (error) {
    console.error(
      '[Supabase:updateJobSourceURL] Error updating job source URL:',
      error,
    );
    throw error;
  }
  console.log(
    `[Supabase:updateJobSourceURL] Updated job source URL on page ${page_index}: "${urlWithoutPageIndex}"`,
  );
}

export async function createJobSourceURLs(
  url: string,
  totalPages: number,
  startFromPageIndex = 2,
): Promise<void> {
  const supabase = getSupabaseClient();
  const urlObject = new URL(url);
  urlObject.searchParams.delete('page');
  const urlWithoutPageIndex = urlObject.toString();
  const { error } = await supabase
    .from('job_source_url')
    .upsert(
      Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter(x => x >= startFromPageIndex)
        .map(page_index => ({
          url: urlWithoutPageIndex,
          page_index,
          status: 'pending',
        })),
    );

  if (error) {
    console.error(
      '[Supabase:createJobSourceURLs] Error inserting job source URL:',
      error,
    );
    throw error;
  }
  console.log(
    `[Supabase:createJobSourceURLs] Inserted job source URL on page ${startFromPageIndex}-${totalPages}: "${urlWithoutPageIndex}"`,
  );
}
