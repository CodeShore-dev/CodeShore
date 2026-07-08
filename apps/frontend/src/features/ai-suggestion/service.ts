import {
  AiSuggestionStatus,
  AiSuggestionTargetTable,
  AiSuggestionWorkflow,
  SupabaseTable,
} from '@codeshore/data-types';

import { httpClient } from '../../httpClient';

// Mirrors `apps/backend/src/features/ai-suggestion/service.ts`'s
// `AiSuggestionEvidence`/`AiSuggestionRecord` exactly (requirement 7.1, 7.2,
// 8.1-8.4): the backend controller returns `Service.list()`/`getById()`'s
// result as-is (this codebase's established snake_case-DB-row-shaped JSON
// convention, same as `company`/`keyword`), so the frontend narrows
// `SupabaseTable.AiSuggestion.evidence` (an untyped `jsonb` column) back to
// its documented sub-fields the same way the backend service does. These
// types aren't exported from `@codeshore/data-types` (only the raw DB-row
// shape is), so they're re-declared here rather than imported from the
// backend, which the frontend cannot import from.
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

export type AiSuggestionRecord = Omit<
  SupabaseTable.AiSuggestion,
  'evidence'
> & {
  evidence: AiSuggestionEvidence;
};

// `Controller.list()` (`GET /ai-suggestion`) returns
// `Service.list()`'s `{ result, count }` directly -- no `searchParams` field
// (unlike `libs/data-types`'s `ListResponse<T>`, which the data-utils layer's
// `fetchAll` returns internally but the ai-suggestion `Service.list()` strips
// before returning to the controller). Modeled as its own type instead of
// reusing `ListResponse<T>` to match the real contract exactly.
export interface AiSuggestionListResponse {
  result: AiSuggestionRecord[];
  count: number;
}

export interface AiSuggestionListFilter {
  targetTable?: AiSuggestionTargetTable;
  status?: AiSuggestionStatus;
  // Inclusive ISO-8601 created_at bounds, for requirement 10.2's 依時間範圍
  // 查詢歷史建議紀錄 history query.
  createdAfter?: string;
  createdBefore?: string;
}

// Progress event streamed by `GET /ai-suggestion/generate` over SSE, mirroring
// `apps/backend/src/features/ai-suggestion/service.ts`'s
// `AiSuggestionGenerateEvent` exactly (task 4.2's documented deviation from
// design.md: only `log`/per-workflow `done`/`error`/overall `done('all')` --
// no per-suggestion `created`/`skipped_duplicate` events, since the 5
// generators each return a single batch result rather than yielding per
// candidate).
export type AiSuggestionGenerateEvent =
  | { type: 'log'; workflow: AiSuggestionWorkflow; message: string }
  | {
      type: 'done';
      workflow: AiSuggestionWorkflow;
      created: number;
      message: string;
    }
  | { type: 'error'; workflow: AiSuggestionWorkflow; message: string }
  | { type: 'done'; workflow: 'all'; created: number };

const BASE = '/api/ai-suggestion';

// List/filter pending (or any-status) suggestions (requirement 7.1).
export const fetchSuggestions = async (
  filter: AiSuggestionListFilter = {},
) => {
  const res = await httpClient.get<AiSuggestionListResponse>(BASE, {
    params: {
      targetTable: filter.targetTable,
      status: filter.status,
      createdAfter: filter.createdAfter,
      createdBefore: filter.createdBefore,
    },
  });
  return res.data;
};

// Single suggestion detail, including its full evidence (requirement 7.2).
export const fetchSuggestion = async (id: string) => {
  const res = await httpClient.get<AiSuggestionRecord>(
    `${BASE}/${encodeURIComponent(id)}`,
  );
  return res.data;
};

// Approve a pending suggestion, optionally landing a reviewer-edited payload
// instead of the originally generated one (requirement 7.3, 7.4).
export const approveSuggestion = async (
  id: string,
  editedPayload?: Record<string, unknown>,
) => {
  const res = await httpClient.patch<AiSuggestionRecord>(
    `${BASE}/${encodeURIComponent(id)}/approve`,
    editedPayload !== undefined ? { editedPayload } : {},
  );
  return res.data;
};

// Reject a pending suggestion, optionally recording a reviewer note
// (requirement 7.3).
export const rejectSuggestion = async (id: string, note?: string) => {
  const res = await httpClient.patch<AiSuggestionRecord>(
    `${BASE}/${encodeURIComponent(id)}/reject`,
    note !== undefined ? { note } : {},
  );
  return res.data;
};

// SSE source for `GET /ai-suggestion/generate` (requirement 1.2), mirroring
// `admin/service.ts`'s `createMvRefreshEventSource`: since a browser
// `EventSource` cannot send custom headers, the auth token travels as a
// `?token=` query param instead (read by the backend's SSE auth guard the
// same way it reads the `Authorization` header for every other route).
export const createGenerateEventSource = (
  workflow?: AiSuggestionWorkflow | 'all',
): EventSource => {
  const { baseURL } = httpClient.defaults;
  const token = localStorage.getItem('token');
  const search = new URLSearchParams();
  if (workflow) search.set('workflow', workflow);
  if (token) search.set('token', token);
  return new EventSource(
    `${baseURL}${BASE}/generate?${search.toString()}`,
  );
};
