import type { PostgrestError } from '@supabase/supabase-js';

import {
  AiSuggestionStatus,
  AiSuggestionTargetTable,
  AiSuggestionWorkflow,
  SupabaseTable,
} from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { getSupabaseClient } from '@codeshore/supabase';

import { TableService } from '../shared-services/supabase/table.service';

/**
 * Fields required to create a new `pending` suggestion. `status`,
 * `flagged_for_review`, `id`, `created_at`, and the review/outcome fields
 * are all owned by `createPendingSuggestion` / later approve-reject flows
 * (task 2.x), not by callers of this method.
 */
export type CreateAiSuggestionInput = Pick<
  SupabaseTable.AiSuggestion,
  | 'target_table'
  | 'workflow'
  | 'action'
  | 'target_key'
  | 'payload'
  | 'evidence'
>;

export type CreatePendingSuggestionResult =
  | { outcome: 'created'; record: SupabaseTable.AiSuggestion }
  | {
      outcome: 'duplicate';
      targetTable: AiSuggestionTargetTable;
      workflow: AiSuggestionWorkflow;
      targetKey: Readonly<Record<string, string>>;
    }
  | { outcome: 'error'; error: PostgrestError };

/**
 * `status` accepts either a single status or multiple (e.g. `['approved',
 * 'rejected']` for the requirement 10.2 audit-history query, which must
 * return both terminal statuses while excluding `pending`).
 * `createdAfter`/`createdBefore` are inclusive ISO-8601 timestamp bounds on
 * `created_at`, used for the requirement 10.2 time-range query.
 */
export type ListAiSuggestionFilter = {
  targetTable?: AiSuggestionTargetTable;
  status?: AiSuggestionStatus | readonly AiSuggestionStatus[];
  createdAfter?: string;
  createdBefore?: string;
};

/**
 * Fields the approval flow (task 2.2) writes when transitioning a `pending`
 * suggestion to `approved`. `status` and `reviewed_at` are owned by
 * `markApproved` itself, not by the caller.
 */
export type MarkApprovedInput = {
  payload: Record<string, unknown>;
  reviewedBy: string;
  resolutionNote: string | null;
  outcome: Record<string, unknown> | null;
  flaggedForReview: boolean;
};

export type MarkApprovedResult =
  | { outcome: 'approved'; record: SupabaseTable.AiSuggestion }
  | { outcome: 'not_pending' }
  | { outcome: 'error'; error: PostgrestError };

/**
 * Fields the rejection flow (task 2.3) writes when transitioning a `pending`
 * suggestion to `rejected`. `status` and `reviewed_at` are owned by
 * `markRejected` itself, not by the caller. Unlike `MarkApprovedInput`, there
 * is no `payload`/`outcome`/`flaggedForReview` -- a rejected suggestion never
 * lands anywhere, so those approve-only fields are left untouched.
 */
export type MarkRejectedInput = {
  reviewerId: string;
  note: string | null;
};

export type MarkRejectedResult =
  | { outcome: 'rejected'; record: SupabaseTable.AiSuggestion }
  | { outcome: 'not_pending' }
  | { outcome: 'error'; error: PostgrestError };

/** Postgres error code for a unique-constraint / unique-index violation. */
const UNIQUE_VIOLATION_CODE = '23505';

export class AiSuggestionService extends TableService<SupabaseTable.AiSuggestion> {
  constructor(logger?: ServiceLogger) {
    super(getSupabaseClient(), 'ai_suggestion', logger);
  }

  /**
   * Creates a new `pending` suggestion for `(target_table, workflow,
   * target_key)`.
   *
   * Requirement 1.4 / task 1.1: dedupe is enforced by the database itself
   * via the partial unique index
   * `ux_ai_suggestion_pending_target (target_table, workflow, target_key)
   * WHERE status = 'pending'` (see
   * `supabase/migrations/20260707000000_create_ai_suggestion.sql`), not by
   * this method scanning the table first. When that index rejects the
   * insert, the resulting Postgres unique-violation (`code: '23505'`) is
   * translated into a `{ outcome: 'duplicate' }` result instead of being
   * thrown, so callers (later generators/approve flow) can treat "already
   * pending" as an ordinary outcome rather than an exceptional one. Any
   * other database error is likewise returned rather than thrown.
   */
  async createPendingSuggestion(
    input: CreateAiSuggestionInput,
  ): Promise<CreatePendingSuggestionResult> {
    const record: Pick<
      SupabaseTable.AiSuggestion,
      | 'target_table'
      | 'workflow'
      | 'action'
      | 'target_key'
      | 'payload'
      | 'evidence'
      | 'status'
      | 'flagged_for_review'
    > = {
      ...input,
      status: 'pending',
      flagged_for_review: false,
    };

    const { data, error } = await this.table
      .insert([record])
      .select()
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        return {
          outcome: 'duplicate',
          targetTable: input.target_table,
          workflow: input.workflow,
          targetKey: input.target_key,
        };
      }
      return { outcome: 'error', error };
    }

    return {
      outcome: 'created',
      record: data as SupabaseTable.AiSuggestion,
    };
  }

  /**
   * Lists suggestions filtered by target table, status (single or multiple),
   * and/or a `created_at` time range, newest first. Used by both the queue
   * list/detail (task 2.1) and the requirement 10.2 audit-history query
   * (task 2.3, e.g. `status: ['approved', 'rejected']` plus `createdAfter`/
   * `createdBefore`); this method only provides the typed data-access
   * primitive.
   *
   * The `gte`/`lte`/multi-value-`$or` filter shapes used below are already
   * supported generically by `fetchAll`'s underlying `fetchList` (see
   * `shared-services/supabase/utils.ts`'s `_fetchList`), so no new query
   * plumbing is added here.
   */
  listByTargetAndStatus(filter: ListAiSuggestionFilter = {}) {
    const where: Record<string, any> = {};
    if (filter.targetTable) {
      where['target_table'] = { eq: filter.targetTable };
    }
    if (filter.status) {
      const statuses = Array.isArray(filter.status)
        ? filter.status
        : [filter.status as AiSuggestionStatus];
      if (statuses.length === 1) {
        where['status'] = { eq: statuses[0] };
      } else if (statuses.length > 1) {
        where['$or'] = statuses
          .map(status => `status.eq.${status}`)
          .join(',');
      }
    }
    if (filter.createdAfter) {
      where['created_at'] = {
        ...where['created_at'],
        gte: filter.createdAfter,
      };
    }
    if (filter.createdBefore) {
      where['created_at'] = {
        ...where['created_at'],
        lte: filter.createdBefore,
      };
    }
    return this.fetchAll({
      where,
      orders: [{ column: 'created_at', ascending: true }],
    });
  }

  /**
   * Atomically transitions a `pending` suggestion to `approved`, writing the
   * (possibly reviewer-edited) payload plus the review/outcome metadata
   * (requirements 1.5, 7.4, 8.5, 8.6, 9.1).
   *
   * The `WHERE id = ? AND status = 'pending'` filter -- not a prior
   * read-then-write check in the caller -- is what actually enforces "an
   * already-approved/rejected suggestion cannot be re-approved" (requirement
   * 1.5) at the data layer: a second, concurrent `markApproved` call against
   * the same row (e.g. two reviewers racing to approve) matches zero rows
   * and cannot corrupt state, rather than blindly overwriting whatever the
   * first call already committed.
   *
   * `.maybeSingle()` (not `.single()`) is used so that "zero rows matched"
   * surfaces as `{ data: null, error: null }` instead of a thrown/`error`
   * response, which this method reports as `{ outcome: 'not_pending' }`
   * rather than conflating it with a genuine database error.
   */
  async markApproved(
    id: string,
    input: MarkApprovedInput,
  ): Promise<MarkApprovedResult> {
    const { data, error } = await this.table
      .update({
        status: 'approved',
        payload: input.payload,
        reviewed_by: input.reviewedBy,
        reviewed_at: new Date().toISOString(),
        resolution_note: input.resolutionNote,
        outcome: input.outcome,
        flagged_for_review: input.flaggedForReview,
      } as any)
      .eq('id', id)
      .eq('status', 'pending')
      .select()
      .maybeSingle();

    if (error) {
      return { outcome: 'error', error };
    }
    if (!data) {
      return { outcome: 'not_pending' };
    }
    return {
      outcome: 'approved',
      record: data as SupabaseTable.AiSuggestion,
    };
  }

  /**
   * Atomically transitions a `pending` suggestion to `rejected`, writing
   * only the review metadata (`reviewed_by`, `reviewed_at`,
   * `resolution_note`) -- never `payload`, `flagged_for_review`, or
   * `outcome`, since a rejected suggestion never lands on its target table
   * (requirement 1.3, 7.3).
   *
   * Mirrors `markApproved`'s exact race-safety pattern: the
   * `WHERE id = ? AND status = 'pending'` filter (not a prior read-then-write
   * check in the caller) is what enforces "an already-approved/rejected
   * suggestion cannot be re-rejected" (requirement 1.5) at the data layer,
   * and `.maybeSingle()` reports "zero rows matched" as `{ outcome:
   * 'not_pending' }` rather than conflating it with a genuine database
   * error.
   */
  async markRejected(
    id: string,
    input: MarkRejectedInput,
  ): Promise<MarkRejectedResult> {
    const { data, error } = await this.table
      .update({
        status: 'rejected',
        reviewed_by: input.reviewerId,
        reviewed_at: new Date().toISOString(),
        resolution_note: input.note,
      } as any)
      .eq('id', id)
      .eq('status', 'pending')
      .select()
      .maybeSingle();

    if (error) {
      return { outcome: 'error', error };
    }
    if (!data) {
      return { outcome: 'not_pending' };
    }
    return {
      outcome: 'rejected',
      record: data as SupabaseTable.AiSuggestion,
    };
  }
}

function isUniqueViolation(error: PostgrestError): boolean {
  return error.code === UNIQUE_VIOLATION_CODE;
}
