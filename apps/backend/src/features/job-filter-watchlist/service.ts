import { Injectable } from '@nestjs/common';

import { SupabaseTable } from '@codeshore/data-types';
import { JobFilterSubscriptionService } from '@codeshore/data-utils';
import {
  JobFilterSnapshot,
  normalizeFilterSnapshot,
} from '@codeshore/shared-utils';

/**
 * Per-user cap on followed filter combinations (design.md "上限數值",
 * requirement 5.1/5.2).
 */
const SUBSCRIPTION_LIMIT = 20;

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
 * Maps a raw `job_filter_subscription` row to the API-facing shape.
 *
 * `totalCount`/`newCount` are placeholders (always `0`) for task 2.1 --
 * real count computation (reusing `MvJobService`, per design.md's
 * "Count 計算" section) lands in task 2.2 and will replace this mapping's
 * placeholder values, not the shape itself.
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

    return {
      status: 'created',
      subscription: toSubscriptionWithCounts(
        data as SupabaseTable.JobFilterSubscription,
      ),
    };
  }
}
