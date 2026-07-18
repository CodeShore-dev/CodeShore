import { describe, expect, it } from 'vitest';

import {
  BELOW_KEY,
  UNMAPPED_GROUP_THRESHOLD,
  groupUnmappedJobs,
} from './queries';
import { AnomalyJob } from './service';

const job = (id: string, location: string): AnomalyJob =>
  ({ id, location, title: id, detail_link: '', crawled_at: '' }) as AnomalyJob;

describe('groupUnmappedJobs', () => {
  it('keeps locations at or above the threshold as their own rows', () => {
    const jobs = Array.from({ length: UNMAPPED_GROUP_THRESHOLD }, (_, i) =>
      job(`a${i}`, '台北'),
    );
    const rows = groupUnmappedJobs(jobs);
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe('台北');
    expect(rows[0].count).toBe(UNMAPPED_GROUP_THRESHOLD);
  });

  it('folds sub-threshold locations into the trailing 其他 bucket', () => {
    const jobs = [
      ...Array.from({ length: UNMAPPED_GROUP_THRESHOLD }, (_, i) =>
        job(`big${i}`, '台北'),
      ),
      job('s1', '宜蘭'),
      job('s2', '花蓮'),
    ];
    const rows = groupUnmappedJobs(jobs);
    const below = rows.find(r => r.key === BELOW_KEY);
    expect(below?.count).toBe(2);
    expect(below?.jobs.map(j => j.id).sort()).toEqual(['s1', 's2']);
  });

  it('labels the empty-string location group', () => {
    const jobs = Array.from({ length: UNMAPPED_GROUP_THRESHOLD }, (_, i) =>
      job(`e${i}`, ''),
    );
    expect(groupUnmappedJobs(jobs)[0].location).toBe('（空字串）');
  });
});
