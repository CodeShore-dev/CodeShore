import { SupabaseTable } from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { JobFilterSnapshot } from '@codeshore/shared-utils';
import { getSupabaseClient } from '@codeshore/supabase';

import { TableService } from '../shared-services/supabase/table.service';

/**
 * Data-access layer for the `job_filter_subscription` table (job-filter-
 * watchlist spec, task 1.3). Follows the exact convention established by
 * `job_preference.service.ts`: every custom method scopes its query by
 * `.eq('user_id', userId)` first, so a request for one user's data can never
 * read or mutate another user's rows -- this is the security-critical
 * property required by design.md's `JobFilterSubscriptionService` section
 * and requirement 7.2 (unauthorized access must not leak whether a given id
 * exists at all, so lookups scoped to the wrong user resolve to `null`/no-op
 * rather than a distinct "forbidden" error).
 */
export class JobFilterSubscriptionService extends TableService<
  SupabaseTable.JobFilterSubscription,
  Omit<SupabaseTable.JobFilterSubscription, 'created_at'>
> {
  constructor(logger?: ServiceLogger) {
    super(getSupabaseClient(), 'job_filter_subscription', logger);
  }

  /**
   * Lists all filter combinations the given user follows, newest first.
   */
  async findByUser(
    userId: string,
  ): Promise<SupabaseTable.JobFilterSubscription[]> {
    const { data, error } = await this.table
      .select()
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as SupabaseTable.JobFilterSubscription[];
  }

  /**
   * Finds the given user's existing subscription for a normalized filter
   * snapshot, used by the create flow's dedup check (design.md "建立流程").
   * `filter_snapshot` is `jsonb`; Postgres/PostgREST `.eq()` performs
   * byte-identical JSON-value equality, which is sufficient because callers
   * are expected to pass an already-`normalizeFilterSnapshot`-normalized
   * value. The comparison value must be passed as a JSON *string*: postgrest-js's
   * `.eq()` builds the query param via `` `eq.${value}` `` template-literal
   * interpolation, so passing the object itself coerces to the literal string
   * `"[object Object]"` (not JSON), which Postgres rejects with "invalid input
   * syntax for type json" -- `JSON.stringify` here is what makes this a real
   * JSON-string comparison instead. `.maybeSingle()` reports "no match" as
   * `null` data rather than an error, since the `(user_id, filter_snapshot)`
   * unique index guarantees at most one row can match.
   */
  async findByUserAndSnapshot(
    userId: string,
    normalizedSnapshot: JobFilterSnapshot,
  ): Promise<SupabaseTable.JobFilterSubscription | null> {
    const { data, error } = await this.table
      .select()
      .eq('user_id', userId)
      .eq('filter_snapshot', JSON.stringify(normalizedSnapshot))
      .maybeSingle();

    if (error) throw error;
    return (data ?? null) as SupabaseTable.JobFilterSubscription | null;
  }

  /**
   * Counts how many filter combinations the given user follows, used to
   * enforce the per-user watchlist limit (design.md "上限數值", requirement
   * 5.1).
   */
  async countByUser(userId: string): Promise<number> {
    const { count, error } = await this.table
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) throw error;
    return count ?? 0;
  }

  /**
   * Deletes a subscription, scoped to the requesting user. The
   * `.eq('user_id', userId).eq('id', id)` double filter -- not a prior
   * read-then-authorize check -- is what enforces that a user can never
   * delete another user's subscription (requirement 7.2): a mismatched
   * `(userId, id)` pair matches zero rows and deletes nothing rather than
   * throwing a distinguishable error.
   *
   * Returns whether a row was actually deleted. Chaining `.select()` onto
   * the delete (mirroring `touchLastViewedAt`'s
   * `.update(...).eq(...).eq(...).select()` pattern) makes PostgREST return
   * the deleted row(s) instead of nothing, so `(data ?? []).length > 0`
   * distinguishes a real deletion from a no-op. Wrong owner and nonexistent
   * id both resolve to `false` -- the same non-leaking result, by design
   * (design.md "更正說明(task 2.4 review 階段發現)"): the caller must not be
   * able to tell those two cases apart from this return value alone.
   */
  async deleteByUserAndId(userId: string, id: string): Promise<boolean> {
    const { data, error } = await this.table
      .delete()
      .eq('user_id', userId)
      .eq('id', id)
      .select();

    if (error) throw error;
    return (data ?? []).length > 0;
  }

  /**
   * Updates a subscription's `last_viewed_at` to now, scoped to the
   * requesting user (design.md "job-filter-watchlist Controller",
   * `PATCH /:id/viewed`). Mirrors `deleteByUserAndId`'s ownership-scoped
   * filter and `AiSuggestionService.markApproved`'s
   * `.update(...).eq(...).eq(...).select().maybeSingle()` pattern: a
   * mismatched `(userId, id)` pair matches zero rows, so `.maybeSingle()`
   * resolves to `null` data instead of an error, and this method surfaces
   * that as `null` rather than mutating (or revealing the existence of)
   * another user's row.
   */
  async touchLastViewedAt(
    userId: string,
    id: string,
  ): Promise<SupabaseTable.JobFilterSubscription | null> {
    const { data, error } = await this.table
      .update({
        last_viewed_at: new Date().toISOString(),
      } as Partial<SupabaseTable.JobFilterSubscription>)
      .eq('user_id', userId)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return (data ?? null) as SupabaseTable.JobFilterSubscription | null;
  }
}
