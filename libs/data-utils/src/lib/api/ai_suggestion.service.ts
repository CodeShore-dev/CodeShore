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
}

function isUniqueViolation(error: PostgrestError): boolean {
  return error.code === UNIQUE_VIOLATION_CODE;
}
