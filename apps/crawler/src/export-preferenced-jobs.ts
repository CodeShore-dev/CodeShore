import { promises as fs } from 'fs';

import { JobPreferenceService } from '@codeshore/data-utils';

export type Preference = 'like' | 'dislike';

/**
 * 直接查 `job_preference` 表,取得某使用者對指定 preference(預設 like)的職缺 id 清單。
 * 不經過 `mv_job`/`get_jobs_by_preference`,因為 re-crawl 只需要 job id。
 */
export async function fetchJobIdsByUserPreference(
  userId: string,
  preference: Preference = 'like',
): Promise<string[]> {
  const { result } = await new JobPreferenceService().fetchAll({
    select: 'job_id',
    where: {
      user_id: { eq: userId },
      preference: { eq: preference },
    },
  });
  return result.map(row => row.job_id);
}

/**
 * 產生與 `re-crawl-from-file.ts` 的 `parseJobIdCsv` 相容的單欄 CSV(含 `job_id` 表頭)。
 */
export function toJobIdCsv(jobIds: string[]): string {
  return ['job_id', ...jobIds].join('\n') + '\n';
}

export async function writeJobIdsCsv(
  jobIds: string[],
  outputPath: string,
): Promise<void> {
  await fs.writeFile(outputPath, toJobIdCsv(jobIds), 'utf-8');
}
