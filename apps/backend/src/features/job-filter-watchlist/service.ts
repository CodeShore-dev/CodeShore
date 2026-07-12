import { Injectable } from '@nestjs/common';

import { SupabaseTable } from '@codeshore/data-types';
import {
  JobFilterSubscriptionService,
  MvJobService,
} from '@codeshore/data-utils';
import {
  JobFilterSnapshot,
  normalizeFilterSnapshot,
} from '@codeshore/shared-utils';
import { CacheService } from '@codeshore/service-cache';

/**
 * Per-user cap on followed filter combinations (design.md "上限數值",
 * requirement 5.1/5.2).
 */
const SUBSCRIPTION_LIMIT = 20;

/**
 * TTL for the cached, count-enriched watchlist (design.md "Count 計算"):
 * mirrors `job/service.ts`'s `getJobPreferencedCount` -- `getOrSet` under a
 * per-user key, 60 second TTL.
 */
const COUNTS_CACHE_TTL = 60 * 1000; // 60 seconds

function countsCacheKey(userId: string): string {
  return `job-filter-watchlist-counts:${userId}`;
}

export interface CreateSubscriptionInput {
  filterSnapshot: JobFilterSnapshot;
  filterWhere: Record<string, unknown>;
  label: string;
}

export interface SubscriptionWithCounts {
  id: string;
  label: string;
  lastViewedAt: string;
  createdAt: string;
  totalCount: number;
  newCount: number;
}

export type CreateSubscriptionResult =
  | {
      status: 'created' | 'already_exists';
      subscription: SubscriptionWithCounts;
    }
  | { status: 'limit_reached'; limit: number };

/**
 * Maps a raw `job_filter_subscription` row to the API-facing shape, with
 * `totalCount`/`newCount` left at their placeholder `0`. `create()` (task
 * 2.1) uses this directly for its `created`/`already_exists` results --
 * real count computation (reusing `MvJobService`, per design.md's "Count
 * 計算" section) is `list()`'s responsibility (task 2.2), which overrides
 * these placeholder fields with `computeSubscriptionCounts`'s result rather
 * than changing `create()`'s already-approved behavior/tests.
 */
function toSubscriptionWithCounts(
  row: SupabaseTable.JobFilterSubscription,
): SubscriptionWithCounts {
  return {
    id: row.id,
    label: row.label,
    lastViewedAt: row.last_viewed_at,
    createdAt: row.created_at,
    totalCount: 0,
    newCount: 0,
  };
}

@Injectable()
export class Service {
  constructor(
    private readonly subscriptionService: JobFilterSubscriptionService,
    private readonly mvJobService: MvJobService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Creates a followed filter combination for `userId`, per design.md's
   * "建立流程" (requirements 1.1-1.4, 3.4, 5.1-5.3):
   * 1. Normalize `input.filterSnapshot` so semantically-equal snapshots with
   *    differently-ordered arrays compare equal.
   * 2. Look up an existing subscription for `(userId, normalizedSnapshot)`.
   *    A hit returns `{ status: 'already_exists', subscription }` without
   *    creating a duplicate row.
   * 3. On a miss, check the user's current subscription count against
   *    `SUBSCRIPTION_LIMIT`. At or above the limit, returns
   *    `{ status: 'limit_reached', limit: SUBSCRIPTION_LIMIT }` without
   *    creating a row.
   * 4. Otherwise inserts a new row with `last_viewed_at` set to the
   *    creation time and returns `{ status: 'created', subscription }`.
   *
   * The database's `(user_id, filter_snapshot)` unique index is a second
   * layer of protection against a concurrent-request race between steps 2
   * and 4; this method does not itself retry or translate a resulting
   * unique-violation error.
   */
  async create(
    userId: string,
    input: CreateSubscriptionInput,
  ): Promise<CreateSubscriptionResult> {
    const normalizedSnapshot = normalizeFilterSnapshot(
      input.filterSnapshot,
    );

    const existing = await this.subscriptionService.findByUserAndSnapshot(
      userId,
      normalizedSnapshot,
    );
    if (existing) {
      return {
        status: 'already_exists',
        subscription: toSubscriptionWithCounts(existing),
      };
    }

    const currentCount = await this.subscriptionService.countByUser(
      userId,
    );
    if (currentCount >= SUBSCRIPTION_LIMIT) {
      return { status: 'limit_reached', limit: SUBSCRIPTION_LIMIT };
    }

    const now = new Date().toISOString();
    const { data, error } = await this.subscriptionService
      .upsert([
        {
          id: crypto.randomUUID(),
          user_id: userId,
          filter_snapshot:
            normalizedSnapshot as unknown as Record<string, unknown>,
          filter_where: input.filterWhere,
          label: input.label,
          last_viewed_at: now,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    await this.invalidateCountsCache(userId);

    return {
      status: 'created',
      subscription: toSubscriptionWithCounts(
        data as SupabaseTable.JobFilterSubscription,
      ),
    };
  }

  /**
   * Computes `{ totalCount, newCount }` for a single subscription, per
   * design.md's "Count 計算" (requirements 2.2, 3.1): reuses `MvJobService`'s
   * existing count-query path (the same one `GET /api/job` uses) rather than
   * building a new query. `totalCount` calls it with the subscription's
   * stored `filterWhere`, unmodified; `newCount` calls it again with
   * `{ ...filterWhere, created_at: { gt: lastViewedAt } }` layered on top.
   * Both calls pass `userId: null` and a minimal `{ from: 0, to: 0 }` range
   * -- per research.md 2.2/`MvJobService`, a `null` user with no `preference`
   * key in `where` routes to the general (preference-independent)
   * `get_unreviewed_jobs` count path, and only the exact `count` is needed,
   * not the row data.
   */
  private async computeSubscriptionCounts(
    filterWhere: Record<string, unknown>,
    lastViewedAt: string,
  ): Promise<{ totalCount: number; newCount: number }> {
    const [totalResult, newResult] = await Promise.all([
      this.mvJobService.fetchMvJobsByUserAndPreference(
        { where: filterWhere, from: 0, to: 0 },
        null,
      ),
      this.mvJobService.fetchMvJobsByUserAndPreference(
        {
          where: {
            ...filterWhere,
            created_at: { gt: lastViewedAt },
          },
          from: 0,
          to: 0,
        },
        null,
      ),
    ]);

    return {
      totalCount: totalResult.count,
      newCount: newResult.count,
    };
  }

  /**
   * Lists `userId`'s followed filter combinations enriched with computed
   * `totalCount`/`newCount` (design.md "Count 計算", requirements 2.2, 3.1).
   * The whole computed list is cached for 60 seconds under
   * `job-filter-watchlist-counts:${userId}` via `CacheService.getOrSet`,
   * mirroring `job/service.ts`'s `getJobPreferencedCount` pattern exactly.
   * Callers that mutate the user's followed list or a subscription's
   * `last_viewed_at` (create/remove/markViewed) must call
   * `invalidateCountsCache(userId)` afterwards so a stale list isn't served.
   */
  async list(userId: string): Promise<SubscriptionWithCounts[]> {
    return this.cacheService.getOrSet(
      countsCacheKey(userId),
      async () => {
        const rows = await this.subscriptionService.findByUser(userId);
        return Promise.all(
          rows.map(async row => {
            const { totalCount, newCount } =
              await this.computeSubscriptionCounts(
                row.filter_where,
                row.last_viewed_at,
              );
            return {
              ...toSubscriptionWithCounts(row),
              totalCount,
              newCount,
            };
          }),
        );
      },
      { ttl: COUNTS_CACHE_TTL },
    );
  }

  /**
   * Invalidates the cached counts list for `userId` (design.md "Count
   * 計算"). Called by `create`/`remove`/`markViewed` after they change the
   * user's followed list or a subscription's `last_viewed_at`, so `list`
   * recomputes on the next call instead of serving stale counts.
   */
  async invalidateCountsCache(userId: string): Promise<void> {
    await this.cacheService.invalidate(countsCacheKey(userId));
  }

  /**
   * Updates `id`'s `last_viewed_at` to the current time on behalf of
   * `userId` (design.md `PATCH /:id/viewed`, requirement 3.2), returning
   * the enriched subscription. `touchLastViewedAt` itself enforces the
   * `userId + id` ownership scoping (requirement 7.2): a mismatched pair
   * (wrong owner or nonexistent id) resolves to `null` rather than
   * mutating or revealing another user's row, and this method mirrors that
   * with a `null` return -- since nothing changed, the counts cache is left
   * untouched in that case.
   */
  async markViewed(
    userId: string,
    id: string,
  ): Promise<SubscriptionWithCounts | null> {
    const row = await this.subscriptionService.touchLastViewedAt(
      userId,
      id,
    );
    if (!row) return null;

    await this.invalidateCountsCache(userId);

    const { totalCount, newCount } = await this.computeSubscriptionCounts(
      row.filter_where,
      row.last_viewed_at,
    );
    return {
      ...toSubscriptionWithCounts(row),
      totalCount,
      newCount,
    };
  }

  /**
   * Removes `id` from `userId`'s followed list (design.md `DELETE /:id`,
   * requirements 4.1, 7.2). `deleteByUserAndId` scopes the delete by
   * `userId + id`, so a mismatched pair deletes nothing, but -- unlike
   * `touchLastViewedAt` -- it returns `void` and gives no signal either way
   * (real deletion and no-op are indistinguishable). Since there's no way
   * to tell whether a row actually changed, invalidation is unconditional
   * here: the small cost of an unnecessary cache clear is preferable to
   * ever serving a stale list after a real deletion.
   */
  async remove(userId: string, id: string): Promise<void> {
    await this.subscriptionService.deleteByUserAndId(userId, id);
    await this.invalidateCountsCache(userId);
  }
}
