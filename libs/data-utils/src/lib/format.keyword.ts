import {
  SupabaseTable,
} from '@codeshore/data-types';

export const extractKeywords = (
  jobKeywords: SupabaseTable.JobKeyword[],
) => {
  return jobKeywords
    .reduce(
      (prev, curr) => {
        (curr.keywords ?? []).forEach((keyword: string) => {
          const existingKeyword = prev.find(
            k => k.id === keyword,
          );
          if (existingKeyword) {
            if (
              existingKeyword.company_id !==
              curr.job!.company_id
            ) {
              existingKeyword.count++;
            }
          } else {
            prev.push({
              id: keyword,
              count: 1,
              company_id: curr.job!.company_id,
            });
          }
        });
        return prev;
      },
      [] as (SupabaseTable.Keyword & {
        company_id: string;
      })[],
    )
    .map(x => ({ id: x.id, count: x.count }));
};
