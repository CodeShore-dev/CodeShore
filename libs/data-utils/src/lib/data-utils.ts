import { SupabaseTable } from '@codeshore/data-types';
import { parseKeywordsOut } from '@codeshore/shared-utils';
import { getSupabaseClient } from '@codeshore/supabase';

import { fetchJobs } from './api/job';
import { resetJobKeywordGroupsByJobKeywords } from './api/job_keyword_group';
import {
  fetchJobKeywords,
  upsertJobKeywords,
} from './api/job_keyword';
import { resetKeywords } from './api/mv_keyword';
import {
  createKeywordGroup,
  updateKeywordGroup,
} from './api/keyword_group';
import {
  createKeywordGroupKeyword,
  updateKeywordGroupKeyword,
} from './api/keyword_group_keyword';
import {
  fetchMvKeywordGroup,
  refreshMvKeywordGroup,
} from './api/mv_keyword_group';


export async function addKeywordToKeywordGroup(
  groupId: string,
  keyword: string,
  category: string | null = null,
  parent: string | null = null,
): Promise<void> {
  const supabase = getSupabaseClient();
  const lowerKeyword = keyword.toLowerCase();
  const { data: existing, error: fetchError } =
    await supabase
      .from('keyword_group')
      .select('keywords')
      .eq('id', groupId)
      .single();

  if (fetchError || !existing) {
    const { error } = await supabase
      .from('keyword_group')
      .insert({
        id: groupId,
        keywords: [lowerKeyword],
        category,
        parent,
      });
    if (error) {
      console.error(
        '[Supabase:addKeywordToGroup] Error creating group:',
        error,
      );
      throw error;
    }
  } else {
    const updated = Array.from(
      new Set([...existing.keywords, lowerKeyword]),
    );
    const { error } = await supabase
      .from('keyword_group')
      .update({ keywords: updated })
      .eq('id', groupId);
    if (error) {
      console.error(
        '[Supabase:addKeywordToGroup] Error updating group:',
        error,
      );
      throw error;
    }
  }
  console.log(
    `[Supabase:addKeywordToGroup] Added "${lowerKeyword}" to group "${groupId}"`,
  );
}

export async function resetJobKeywords(
  keywordGroup?: string,
  keyword?: string,
) {
  const { result: keywordGroups } =
    await fetchMvKeywordGroup({
      from: 0,
      to: -1,
      where: { category: { 'not.is': null } },
    });
  const { result: jobs } = await fetchJobs({
    from: 0,
    to: -1,
  });
  const jobKeywords: SupabaseTable.JobKeyword[] = jobs.map(
    x => ({
      id: x.id,
      ...parseKeywordsOut(
        x.description,
        keywordGroups
          .flatMap(m => m.keywords)
          .concat(
            [keywordGroup, keyword].filter(
              Boolean,
            ) as string[],
          ),
      ),
    }),
  );
  return upsertJobKeywords(jobKeywords);
}

export async function resetJobKeywords_Keywords_JobJoinKeywordGroup(
  keywordGroup?: string,
  keyword?: string,
) {
  await resetJobKeywords(keywordGroup, keyword);
  const { result: jobKeywords } = await fetchJobKeywords({
    from: 0,
    to: -1,
  });
  await resetKeywords();
  await refreshMvKeywordGroup();
  await resetJobKeywordGroupsByJobKeywords(
    jobKeywords,
  );
}

export async function createKeywordGroup_KeywordGroupJoinKeyword(
  keywordGroup: string,
  keywords: string[],
  category: string | null = null,
  parent: string | null = null,
) {
  await createKeywordGroup(keywordGroup, category, parent);
  return createKeywordGroupKeyword(
    keywordGroup,
    keywords,
  );
}

export async function updateKeywordGroup_KeywordGroupJoinKeyword(
  keywordGroup: string,
  keywords: string[],
  category: string | null = null,
  parent: string | null = null,
) {
  await updateKeywordGroup(keywordGroup, category, parent);
  return updateKeywordGroupKeyword(
    keywordGroup,
    keywords,
  );
}
