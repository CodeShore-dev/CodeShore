import { Injectable } from '@nestjs/common';

import {
  AiSuggestionService,
  CreateAiSuggestionInput,
  CreatePendingSuggestionResult,
  ListAiSuggestionFilter,
} from '@codeshore/data-utils';
import { SupabaseTable } from '@codeshore/data-types';

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
}
