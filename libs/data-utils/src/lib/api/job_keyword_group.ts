import { SupabaseTable } from '@codeshore/data-types';
import { getSupabaseClient } from '@codeshore/supabase';

import { fetchJobKeywords } from './job_keyword';
import { fetchMvKeywordGroup } from './mv_keyword_group';

export async function resetJobKeywordGroups(
  jobJoinKeywordGroups: SupabaseTable.JobJoinKeywordGroup[],
) {
  const supabase = getSupabaseClient();
  const { error: deleteError } = await supabase
    .from('job_keyword_group')
    .delete()
    .neq('job_id', '');

  if (deleteError) {
    console.error(
      '[Supabase:resetJobJoinKeywordGroups] Error deleting job join keyword group:',
      deleteError,
    );
  } else {
    console.log(
      `[Supabase:resetJobJoinKeywordGroups] Successfully deleted job join keyword group.`,
    );
  }

  const { error } = await supabase
    .from('job_keyword_group')
    .upsert(jobJoinKeywordGroups);

  if (error) {
    console.error(
      '[Supabase:resetJobJoinKeywordGroups] Error inserting job join keyword group:',
      error,
    );
  } else {
    console.log(
      `[Supabase:resetJobJoinKeywordGroups] Successfully inserted ${jobJoinKeywordGroups.length} job join keyword group.`,
    );
  }
}

export async function resetJobKeywordGroupsByJobKeywords(
  jobKeywords?: SupabaseTable.JobKeyword[],
) {
  const _jobKeywords =
    jobKeywords ??
    (await fetchJobKeywords({ from: 0, to: -1 })).result;
  const { result: keywordGroups } =
    await fetchMvKeywordGroup({
      from: 0,
      to: -1,
      where: { category: { 'not.is': null } },
    });

  resetJobKeywordGroups(
    _jobKeywords
      .flatMap(jobKeyword =>
        jobKeyword.keywords.map(keyword => {
          const keywordGroup = keywordGroups.find(x =>
            x.keywords.includes(keyword),
          );
          return {
            job_id: jobKeyword.id,
            keyword_group: keywordGroup?.keyword_group!,
            keywords: keywordGroup?.keywords.join(',')!,
          };
        }),
      )
      .filter(x => !!x.keyword_group && !!x.keywords)
      .filter(
        (x, i, arr) =>
          arr.findIndex(
            y =>
              y.job_id === x.job_id &&
              y.keyword_group === x.keyword_group,
          ) === i,
      ),
  );
}

export async function deleteJobJoinKeywordGroup(
  keyword_group: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('job_keyword_group')
    .delete()
    .eq('keyword_group', keyword_group);

  if (error) {
    console.error(
      '[Supabase:deleteJobJoinKeywordGroup] Error deleting job join keyword group:',
      error,
    );
  } else {
    console.log(
      `[Supabase:deleteJobJoinKeywordGroup] Successfully deleted job join keyword group.`,
    );
  }
}
