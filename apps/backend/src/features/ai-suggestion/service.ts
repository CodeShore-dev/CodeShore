import { Injectable } from '@nestjs/common';

import {
  AiSuggestionService,
  CreateAiSuggestionInput,
  CreatePendingSuggestionResult,
  JobDescriptionBinService,
  KeywordBinService,
  ListAiSuggestionFilter,
  LocationGroupLocationService,
  LocationGroupService,
  MvLocationGroupService,
  MvTechService,
  refreshAllMaterializedViews,
  TechKeywordService,
  TechParentService,
  TechService,
} from '@codeshore/data-utils';
import {
  AiSuggestionAction,
  AiSuggestionStatus,
  SupabaseTable,
} from '@codeshore/data-types';

import { detectTechParentCycle } from './validation/cycle-check';

/**
 * `AiSuggestionEvidence` per design.md's "AiSuggestionService（Full Block）"
 * `Service 介面`. The `libs/data-utils` layer stores `evidence` as an
 * untyped `jsonb` column (`Record<string, unknown>`); this narrows it back
 * to the documented sub-fields for callers of `list()`/`getById()`
 * (requirement 7.1, 8.1-8.4, 10.1-10.2).
 */
export interface AiSuggestionEvidence {
  reasoning: string;
  confidence?: number;
  needsVerification?: boolean;
  affectedCount?: number;
  similarItems?: ReadonlyArray<{
    id: string;
    label: string;
    score: number;
  }>;
  conflict?: boolean;
  correlationId?: string;
}

/**
 * A suggestion row as returned by this service's `list()`/`getById()`, with
 * `evidence` narrowed to `AiSuggestionEvidence` instead of the data-utils
 * layer's untyped `jsonb` shape.
 */
export type AiSuggestionRecord = Omit<
  SupabaseTable.AiSuggestion,
  'evidence'
> & {
  evidence: AiSuggestionEvidence;
};

export type GetByIdResult =
  | { found: true; record: AiSuggestionRecord }
  | { found: false };

/**
 * Per-approval regression check (requirement 8.5, 8.6). `beforeCounts`/
 * `afterCounts` are single-entry records keyed by whichever materialized
 * view is most directly relevant to the suggestion's `target_table` (see
 * `countTargetFor` below) -- not a full snapshot of every view.
 */
export interface AiSuggestionOutcome {
  affectedViews: readonly string[];
  beforeCounts: Readonly<Record<string, number>>;
  afterCounts: Readonly<Record<string, number>>;
  exceedsExpectedMagnitude: boolean;
}

/**
 * Discriminated `approve()` failure per design.md's `AiSuggestionService（Full
 * Block）` `AiSuggestionApproveError`.
 */
export type AiSuggestionApproveError =
  | { kind: 'conflict'; message: string }
  | { kind: 'validation'; message: string }
  | { kind: 'write_failed'; message: string }
  | { kind: 'not_found'; message: string };

export type ApproveResult =
  | { ok: true; record: AiSuggestionRecord }
  | { ok: false; error: AiSuggestionApproveError };

/**
 * Discriminated `reject()` failure. Rejection is a pure metadata transition
 * (it never writes to a target table or refreshes materialized views), so
 * unlike `AiSuggestionApproveError` there is no `conflict`/`validation`/
 * `write_failed` case for a target-table write -- only "not actionable"
 * (not found, or no longer `pending`) and a data-layer write failure while
 * recording the rejection itself.
 */
export type AiSuggestionRejectError =
  | { kind: 'not_found'; message: string }
  | { kind: 'write_failed'; message: string };

export type RejectResult =
  | { ok: true; record: AiSuggestionRecord }
  | { ok: false; error: AiSuggestionRejectError };

/** The materialized view most directly affected by each target table. */
type CountTarget = 'mv_tech' | 'mv_location_group';

function countTargetFor(
  targetTable: SupabaseTable.AiSuggestion['target_table'],
): CountTarget {
  // `job_description_bin`/`keyword_bin` both feed keyword extraction, which
  // in turn feeds `mv_tech` -- there is no dedicated materialized view for
  // either exclusion list itself.
  switch (targetTable) {
    case 'tech':
    case 'tech_keyword':
    case 'tech_parent':
    case 'job_description_bin':
    case 'keyword_bin':
      return 'mv_tech';
    case 'location_group':
    case 'location_group_location':
      return 'mv_location_group';
  }
}

/** Result of attempting to write a suggestion's payload to its target table. */
type WriteOutcome =
  | { ok: true }
  | { ok: false; kind: 'validation' | 'write_failed'; message: string };

function toWriteOutcome(
  error: { message?: string } | null | undefined,
): WriteOutcome {
  if (error) {
    return {
      ok: false,
      kind: 'write_failed',
      message: error.message ?? 'Unknown error writing to the target table',
    };
  }
  return { ok: true };
}

/**
 * Structural shape shared by the 4 single-`id`-primary-key target-table
 * services (`JobDescriptionBinService`/`TechService`/`KeywordBinService`/
 * `LocationGroupService`) -- each is a plain `TableService` subclass whose
 * inherited `update`/`delete` filter on a single `id` column, which is
 * exactly what these 4 tables' primary keys are.
 */
interface SingleIdWriter {
  upsert(
    records: unknown[],
  ): PromiseLike<{ error: { message?: string } | null }>;
  update(
    record: Record<string, unknown>,
  ): PromiseLike<{ error: { message?: string } | null }>;
  delete(id: string): PromiseLike<{ error: { message?: string } | null }>;
}

async function writeSingleId(
  writer: SingleIdWriter,
  action: AiSuggestionAction,
  targetKey: Readonly<Record<string, string>> | null,
  payload: Record<string, unknown>,
): Promise<WriteOutcome> {
  if (action === 'insert') {
    const { error } = await writer.upsert([payload]);
    return toWriteOutcome(error);
  }
  const id = targetKey?.['id'] ?? (payload['id'] as string | undefined);
  if (!id) {
    return {
      ok: false,
      kind: 'validation',
      message: `Cannot ${action} without an id (expected target_key.id or payload.id)`,
    };
  }
  if (action === 'update') {
    const { error } = await writer.update({ ...payload, id });
    return toWriteOutcome(error);
  }
  const { error } = await writer.delete(id);
  return toWriteOutcome(error);
}

/**
 * Shared dispatch for the 3 composite-primary-key target-table services
 * (`TechKeywordService`/`TechParentService`/`LocationGroupLocationService`),
 * whose inherited `TableService.update`/`delete` cannot address a single row
 * (see each service's `updateBy*`/`deleteBy*` doc comments) -- the caller
 * supplies those methods directly since their signatures differ per table.
 */
async function writeCompositeKey(
  action: AiSuggestionAction,
  targetKey: Readonly<Record<string, string>> | null,
  keyNames: readonly [string, string],
  upsert: (
    records: unknown[],
  ) => PromiseLike<{ error: { message?: string } | null }>,
  update: (
    keyA: string,
    keyB: string,
    values: Record<string, unknown>,
  ) => PromiseLike<{ error: { message?: string } | null }>,
  del: (
    keyA: string,
    keyB: string,
  ) => PromiseLike<{ error: { message?: string } | null }>,
  payload: Record<string, unknown>,
): Promise<WriteOutcome> {
  if (action === 'insert') {
    const { error } = await upsert([payload]);
    return toWriteOutcome(error);
  }
  const keyA = targetKey?.[keyNames[0]];
  const keyB = targetKey?.[keyNames[1]];
  if (!keyA || !keyB) {
    return {
      ok: false,
      kind: 'validation',
      message: `Cannot ${action} without target_key.${keyNames[0]} and target_key.${keyNames[1]}`,
    };
  }
  if (action === 'update') {
    const { error } = await update(keyA, keyB, payload);
    return toWriteOutcome(error);
  }
  const { error } = await del(keyA, keyB);
  return toWriteOutcome(error);
}

/**
 * NestJS-layer service for the AI suggestion review queue (requirements
 * 1.1, 1.4, 7.1, 10.2). This is a thin wrapper around
 * `libs/data-utils`'s `AiSuggestionService`: dedupe-on-create is already
 * enforced there (task 1.1's DB unique index, surfaced via
 * `createPendingSuggestion`'s `created`/`duplicate`/`error` outcome), and
 * list/detail queries are already provided via `listByTargetAndStatus`/
 * `fetchAll`. Nothing here reimplements that logic; it only adapts it to
 * the shape this feature's controller (task 2.4) and later
 * approve/reject/generate tasks (2.2, 2.3, 4.2) will call.
 *
 * Named `Service` (not `AiSuggestionService`) to match this repo's
 * feature-service convention (see `keyword/service.ts`, `admin/service.ts`)
 * and to avoid colliding with the data-utils `AiSuggestionService` class
 * when both are imported in the same file.
 */
@Injectable()
export class Service {
  constructor(
    private readonly aiSuggestionService: AiSuggestionService,
    private readonly jobDescriptionBinService: JobDescriptionBinService,
    private readonly techService: TechService,
    private readonly keywordBinService: KeywordBinService,
    private readonly techKeywordService: TechKeywordService,
    private readonly techParentService: TechParentService,
    private readonly locationGroupService: LocationGroupService,
    private readonly locationGroupLocationService: LocationGroupLocationService,
    private readonly mvTechService: MvTechService,
    private readonly mvLocationGroupService: MvLocationGroupService,
  ) {}

  /**
   * Lists suggestions, optionally filtered by `targetTable` and/or
   * `status` (requirement 7.1: 後台審核介面 shall 讓維運者依目標資料表、
   * 狀態篩選待審建議清單; requirement 10.2: 可依目標資料表查詢歷史建議
   * 紀錄). Delegates directly to the data-utils layer's
   * `listByTargetAndStatus`, which already accepts this same
   * `{ targetTable?, status? }` filter shape.
   */
  async list(filter: ListAiSuggestionFilter = {}) {
    const { result, count } =
      await this.aiSuggestionService.listByTargetAndStatus(filter);
    return {
      result: result as unknown as AiSuggestionRecord[],
      count,
    };
  }

  /**
   * Requirement 10.2's audit-history query: 可依目標資料表或時間範圍查詢
   * 歷史建議紀錄，包含已核准與已駁回的建議. A thin, requirement-10.2-scoped
   * wrapper over `list()` that defaults `status` to both terminal states
   * (`approved` and `rejected`, never `pending`) so callers filtering by
   * `targetTable` and/or `createdAfter`/`createdBefore` don't have to
   * remember to exclude `pending` themselves; an explicit `status` in
   * `filter` still overrides this default (e.g. to narrow to only
   * `rejected`).
   */
  async history(filter: ListAiSuggestionFilter = {}) {
    return this.list({
      status: ['approved', 'rejected'] as readonly AiSuggestionStatus[],
      ...filter,
    });
  }

  /**
   * Returns the full detail of a single suggestion by id, including its
   * `evidence` sub-fields (confidence/affectedCount/similarItems/conflict/
   * reasoning, per design.md's `AiSuggestionEvidence`), or a clear
   * not-found result rather than throwing or returning `undefined`.
   *
   * There is no dedicated `getById` primitive in the data-utils layer yet;
   * this uses the inherited `fetchAll` with a `where: { id: { eq: id } }`
   * filter rather than adding one, to keep the data-access-layer change
   * surface at zero for this task.
   */
  async getById(id: string): Promise<GetByIdResult> {
    const { result } = await this.aiSuggestionService.fetchAll({
      where: { id: { eq: id } },
    });
    const record = result[0];
    if (!record) {
      return { found: false };
    }
    return {
      found: true,
      record: record as unknown as AiSuggestionRecord,
    };
  }

  /**
   * Creates a new `pending` suggestion, surfacing the dedupe outcome
   * (`created`/`duplicate`/`error`) from `createPendingSuggestion` rather
   * than swallowing it -- callers (later generator tasks 3.x) must be able
   * to distinguish "created a new pending suggestion" from "one already
   * exists for this target" from "the write itself failed" (requirement
   * 1.4).
   */
  async createSuggestion(
    input: CreateAiSuggestionInput,
  ): Promise<CreatePendingSuggestionResult> {
    return this.aiSuggestionService.createPendingSuggestion(input);
  }

  /**
   * Approves a `pending` suggestion: validates it (cycle-checking hierarchy
   * suggestions), lands the (possibly reviewer-edited) payload on the
   * target table directly through the `libs/data-utils` write services --
   * never through the `apps/backend/src/features/keyword` HTTP
   * controller/service, per design.md's "落地寫入的分工原則" -- triggers the
   * downstream materialized-view refresh, computes the before/after
   * regression outcome, and atomically transitions the suggestion's status
   * (requirements 1.5, 4.2, 7.4, 8.2, 8.5, 8.6, 9.1, 9.2, 9.3).
   */
  async approve(
    id: string,
    editedPayload: Record<string, unknown> | undefined,
    reviewerId: string,
  ): Promise<ApproveResult> {
    const lookup = await this.getById(id);
    if (!lookup.found || lookup.record.status !== 'pending') {
      return {
        ok: false,
        error: {
          kind: 'not_found',
          message: `No pending suggestion found for id "${id}" (it does not exist, or has already been approved/rejected)`,
        },
      };
    }
    const suggestion = lookup.record;
    // Requirement 7.4: reviewer-edited content wins over the originally
    // generated payload when present.
    const effectivePayload = editedPayload ?? suggestion.payload;

    // Requirement 4.2 / 8.2: hierarchy-type suggestions are cycle-checked
    // before any write. A detected cycle rejects the approval outright --
    // no write method is called and the suggestion's status is left
    // untouched (still `pending`), so it remains resolvable/re-approvable
    // once the conflicting data is fixed.
    if (suggestion.target_table === 'tech_parent') {
      const parent = effectivePayload['parent'];
      const child = effectivePayload['child'];
      if (typeof parent !== 'string' || typeof child !== 'string') {
        return {
          ok: false,
          error: {
            kind: 'validation',
            message:
              'tech_parent suggestions require string "parent" and "child" fields in the payload',
          },
        };
      }
      const cycleResult = await detectTechParentCycle(parent, child);
      if (cycleResult.hasCycle) {
        const conflictPath = (cycleResult.conflictPath ?? []).join(' -> ');
        return {
          ok: false,
          error: {
            kind: 'conflict',
            message: `Approving parent "${parent}" -> child "${child}" would create a tech_parent cycle: ${conflictPath}`,
          },
        };
      }
    }

    const countTarget = countTargetFor(suggestion.target_table);
    const beforeCount = await this.countFor(countTarget);

    const writeResult = await this.writeToTargetTable(
      suggestion,
      effectivePayload,
    );
    if (!writeResult.ok) {
      // Status is intentionally left untouched (still `pending`) so a later
      // `approve()` retry can succeed once the underlying write problem is
      // resolved (requirement 9.3).
      return {
        ok: false,
        error: { kind: writeResult.kind, message: writeResult.message },
      };
    }

    // IMPORTANT (requirement 9.3's accepted limitation): the target-table
    // write above has already landed by this point. There is no distributed
    // transaction spanning the target-table write and the materialized-view
    // refresh below; if the refresh fails, the row change is not rolled
    // back. We still report `write_failed` (and leave the suggestion
    // `pending`) so the suggestion stays flagged as needing a retry -- a
    // retried `approve()` re-runs the (upsert-based, effectively idempotent)
    // write and then retries the refresh. This is a known/accepted gap, not
    // something this task solves with distributed transactions.
    const affectedViews = new Set<string>();
    let refreshSucceeded = false;
    let refreshErrorMessage: string | undefined;
    for await (const event of refreshAllMaterializedViews()) {
      if (event.type === 'log' || event.type === 'error') {
        affectedViews.add(event.step);
      }
      if (event.type === 'error') {
        refreshErrorMessage = event.message;
      }
      if (event.type === 'done') {
        refreshSucceeded = event.success;
      }
    }
    if (!refreshSucceeded) {
      return {
        ok: false,
        error: {
          kind: 'write_failed',
          message: `Materialized view refresh failed after the ${suggestion.target_table} write already landed: ${refreshErrorMessage ?? 'refresh pipeline did not report success'}`,
        },
      };
    }

    // Requirement 8.5 / 8.6: compare the pre-write and post-refresh counts
    // for the view most relevant to this target table, and flag the
    // suggestion for manual review if the actual change is more than 3x the
    // originally estimated `evidence.affectedCount` (when that estimate is
    // present).
    const afterCount = await this.countFor(countTarget);
    const affectedCountEstimate = suggestion.evidence.affectedCount;
    const exceedsExpectedMagnitude =
      typeof affectedCountEstimate === 'number' &&
      Math.abs(afterCount - beforeCount) > affectedCountEstimate * 3;

    const outcome: AiSuggestionOutcome = {
      affectedViews: Array.from(affectedViews),
      beforeCounts: { [countTarget]: beforeCount },
      afterCounts: { [countTarget]: afterCount },
      exceedsExpectedMagnitude,
    };

    const resolutionNote = editedPayload
      ? `Reviewer edited the suggested payload before approval: ${JSON.stringify(editedPayload)}`
      : null;

    const markResult = await this.aiSuggestionService.markApproved(id, {
      payload: effectivePayload,
      reviewedBy: reviewerId,
      resolutionNote,
      outcome: outcome as unknown as Record<string, unknown>,
      flaggedForReview: exceedsExpectedMagnitude,
    });

    if (markResult.outcome === 'error') {
      return {
        ok: false,
        error: {
          kind: 'write_failed',
          message: `Failed to record the approval for suggestion ${id} after the write already landed: ${markResult.error.message}`,
        },
      };
    }
    if (markResult.outcome === 'not_pending') {
      // A concurrent approve/reject won the race between this call's
      // initial pending check and this final atomic transition (enforced by
      // `markApproved`'s `WHERE status = 'pending'` filter, requirement
      // 1.5). The target-table write above still landed (same accepted
      // limitation as above); the suggestion's own status is left as
      // whatever the concurrent caller already set.
      return {
        ok: false,
        error: {
          kind: 'write_failed',
          message: `Suggestion ${id} was no longer pending by the time the approval completed (concurrent approve/reject)`,
        },
      };
    }

    return {
      ok: true,
      record: markResult.record as unknown as AiSuggestionRecord,
    };
  }

  /**
   * Rejects a `pending` suggestion: records the reviewer, review time, and
   * rejection note, and transitions its status to `rejected` -- a pure
   * metadata transition that never writes to any target-table write service
   * and never triggers `refreshAllMaterializedViews` (requirement 1.3's
   * "while pending, don't write to production tables" extends naturally to
   * "when rejected, never write to production tables either", requirement
   * 7.3, 10.1).
   *
   * Mirrors `approve()`'s exact not-found/not-actionable handling: looking
   * up the suggestion first and rejecting up front (without calling
   * `markRejected` at all) when it doesn't exist or is no longer `pending`,
   * so an already-approved/already-rejected suggestion cannot be rejected a
   * second time (requirement 1.5).
   */
  async reject(
    id: string,
    note: string | undefined,
    reviewerId: string,
  ): Promise<RejectResult> {
    const lookup = await this.getById(id);
    if (!lookup.found || lookup.record.status !== 'pending') {
      return {
        ok: false,
        error: {
          kind: 'not_found',
          message: `No pending suggestion found for id "${id}" (it does not exist, or has already been approved/rejected)`,
        },
      };
    }

    const markResult = await this.aiSuggestionService.markRejected(id, {
      reviewerId,
      note: note ?? null,
    });

    if (markResult.outcome === 'error') {
      return {
        ok: false,
        error: {
          kind: 'write_failed',
          message: `Failed to record the rejection for suggestion ${id}: ${markResult.error.message}`,
        },
      };
    }
    if (markResult.outcome === 'not_pending') {
      // A concurrent approve/reject won the race between this call's
      // initial pending check and this final atomic transition (enforced by
      // `markRejected`'s `WHERE status = 'pending'` filter, requirement 1.5).
      return {
        ok: false,
        error: {
          kind: 'not_found',
          message: `Suggestion ${id} was no longer pending by the time the rejection completed (concurrent approve/reject)`,
        },
      };
    }

    return {
      ok: true,
      record: markResult.record as unknown as AiSuggestionRecord,
    };
  }

  /**
   * Reads the current row count of the materialized view most relevant to
   * `target_table` (`countTargetFor`), used to compute `AiSuggestionOutcome`
   * before the write and again after the refresh (requirement 8.5, 8.6).
   */
  private async countFor(view: CountTarget): Promise<number> {
    const service =
      view === 'mv_tech' ? this.mvTechService : this.mvLocationGroupService;
    const { count } = await service.fetchAll();
    return count;
  }

  /**
   * Dispatches the approved write to the correct `libs/data-utils` service
   * method for `suggestion.target_table`, based on `suggestion.action`.
   * Single-`id`-primary-key tables use the inherited `upsert`/`update`/
   * `delete`; composite-primary-key tables use their dedicated `updateBy*`/
   * `deleteBy*` methods (see `writeSingleId`/`writeCompositeKey` above).
   */
  private async writeToTargetTable(
    suggestion: AiSuggestionRecord,
    payload: Record<string, unknown>,
  ): Promise<WriteOutcome> {
    const { target_table, action, target_key } = suggestion;
    switch (target_table) {
      case 'job_description_bin':
        return writeSingleId(
          this.jobDescriptionBinService,
          action,
          target_key,
          payload,
        );
      case 'tech':
        return writeSingleId(
          this.techService,
          action,
          target_key,
          payload,
        );
      case 'keyword_bin':
        return writeSingleId(
          this.keywordBinService,
          action,
          target_key,
          payload,
        );
      case 'location_group':
        return writeSingleId(
          this.locationGroupService,
          action,
          target_key,
          payload,
        );
      case 'tech_keyword':
        return writeCompositeKey(
          action,
          target_key,
          ['tech', 'keyword'],
          records => this.techKeywordService.upsert(records as any[]),
          (keyA, keyB, values) =>
            this.techKeywordService.updateByTechAndKeyword(
              keyA,
              keyB,
              values,
            ),
          (keyA, keyB) =>
            this.techKeywordService.deleteByTechAndKeyword(keyA, keyB),
          payload,
        );
      case 'tech_parent':
        return writeCompositeKey(
          action,
          target_key,
          ['parent', 'child'],
          records => this.techParentService.upsert(records as any[]),
          (keyA, keyB, values) =>
            this.techParentService.updateByParentAndChild(
              keyA,
              keyB,
              values,
            ),
          (keyA, keyB) =>
            this.techParentService.deleteByParentAndChild(keyA, keyB),
          payload,
        );
      case 'location_group_location':
        return writeCompositeKey(
          action,
          target_key,
          ['location_group', 'location'],
          records =>
            this.locationGroupLocationService.upsert(records as any[]),
          (keyA, keyB, values) =>
            this.locationGroupLocationService.updateByGroupAndLocation(
              keyA,
              keyB,
              values,
            ),
          (keyA, keyB) =>
            this.locationGroupLocationService.deleteByGroupAndLocation(
              keyA,
              keyB,
            ),
          payload,
        );
    }
  }
}
