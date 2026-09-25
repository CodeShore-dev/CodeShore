import { SupabaseTable } from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { DEFAULT_PREFERENCE_REASON } from '@codeshore/shared-utils';
import { getSupabaseClient } from '@codeshore/supabase';

import { TableService } from '../shared-services/supabase/table.service';

export class JobPreferenceService extends TableService<
  SupabaseTable.JobPreference,
  // reason has a DB default ('未分類'), so writes may omit it.
  Omit<SupabaseTable.JobPreference, 'updated_at' | 'reason'> & {
    reason?: string;
  }
> {
  constructor(logger?: ServiceLogger) {
    super(getSupabaseClient(), 'job_preference', logger);
  }
  deleteByUserAndPreference(
    userId: string,
    preference: string,
  ) {
    return this.table
      .delete()
      .eq('user_id', userId)
      .eq('preference', preference);
  }
  /**
   * Moves every record of this user/preference that uses `reason` back to
   * the default reason. Only `reason` is written: `preference` stays as-is
   * and `updated_at` is untouched, so "recently marked" ordering is kept.
   */
  async resetReason(
    userId: string,
    preference: 'like' | 'dislike',
    reason: string,
  ): Promise<{ updated: number }> {
    const { error, count } = await this.table
      .update({ reason: DEFAULT_PREFERENCE_REASON }, { count: 'exact' })
      .eq('user_id', userId)
      .eq('preference', preference)
      .eq('reason', reason);
    if (error) throw new Error(error.message);
    return { updated: count ?? 0 };
  }
  /**
   * Batch-renames every record of this user/preference from `from` to `to`.
   * Only `reason` is written: `preference` stays as-is and `updated_at` is
   * untouched, so "recently marked" ordering is kept (design.md D9,
   * requirement 9.3).
   */
  async renameReason(
    userId: string,
    preference: 'like' | 'dislike',
    from: string,
    to: string,
  ): Promise<{ updated: number }> {
    const { error, count } = await this.table
      .update({ reason: to }, { count: 'exact' })
      .eq('user_id', userId)
      .eq('preference', preference)
      .eq('reason', from);
    if (error) throw new Error(error.message);
    return { updated: count ?? 0 };
  }
  /**
   * Whether any record already uses `reason` for this user/preference,
   * used to detect a name collision before a rename (requirement 9.5).
   */
  async reasonExists(
    userId: string,
    preference: 'like' | 'dislike',
    reason: string,
  ): Promise<boolean> {
    const { error, count } = await this.table
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('preference', preference)
      .eq('reason', reason);
    if (error) throw new Error(error.message);
    return (count ?? 0) > 0;
  }
}
