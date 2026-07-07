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

export type ListAiSuggestionFilter = {
  targetTable?: AiSuggestionTargetTable;
  status?: AiSuggestionStatus;
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
   * Lists suggestions filtered by target table and/or status, newest first.
   * Used by the (later, task 2.1/2.3) queue list/detail and audit-history
   * queries; this method only provides the typed data-access primitive.
   */
  listByTargetAndStatus(filter: ListAiSuggestionFilter = {}) {
    const where: Record<string, { eq: string }> = {};
    if (filter.targetTable) {
      where['target_table'] = { eq: filter.targetTable };
    }
    if (filter.status) {
      where['status'] = { eq: filter.status };
    }
    return this.fetchAll({
      where,
      orders: [{ column: 'created_at', ascending: false }],
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
}

function isUniqueViolation(error: PostgrestError): boolean {
  return error.code === UNIQUE_VIOLATION_CODE;
}
