import { httpClient } from '../../httpClient';

// Mirrors `apps/backend/src/features/keyword-curation/graph.types.ts` exactly
// (task 1.1, already committed) field-for-field. Frontend and backend are
// separate TS projects in this monorepo, and there is no `@codeshore/data-types`
// -style shared package for this feature's request/response shapes -- the
// established convention for this kind of backend-app-local type is to
// hand-mirror it on the frontend instead (see
// `ai-suggestion/service.ts`'s `AiSuggestionEvidence`/`AiSuggestionRecord`
// comment for the precedent), so these are redeclared here rather than
// imported from the backend, which the frontend cannot import from.

export interface QueuedKeyword {
  id: string; // keyword text itself (keyword.id)
  count: number; // occurrence count in job postings
  affectedJobCount: number;
}

// AI recommendation (interrupt payload). `path: 'ai_failed'` is the
// LLM-failure degradation variant (requirement 3.5, 9.2).
export type AiRecommendation =
  | {
      path: 'A';
      matchedTech: { id: string; label: string; category: string };
      confidence: number; // 0-1
      reasoning: string;
      affectedJobCount: number;
    }
  | {
      path: 'B';
      suggestedTech: SuggestedNewTech;
      suggestedEdges: SuggestedEdge[];
      reasoning: string;
      affectedJobCount: number;
    }
  | {
      path: 'C';
      reasoning: string;
      affectedJobCount: number;
    }
  | {
      path: 'ai_failed';
      error: string;
    };

export interface SuggestedNewTech {
  id: string;
  label: string;
  category: string;
  tags: string[];
  iconSlugs: string[]; // defaults to [], admin may fill in on the frontend
}

export interface SuggestedEdge {
  type: 'parent' | 'child';
  techId: string;
  techLabel: string;
  reasoning: string;
}

// Human decision (resume payload).
export type HumanDecision =
  | { path: 'A'; confirmedTechId: string }
  | { path: 'B'; newTech: NewTechFields; confirmedEdges: ConfirmedEdge[] }
  | { path: 'C' };

export interface NewTechFields {
  id: string;
  label: string;
  category: string;
  iconSlugs: string[];
  tags: string[];
}

export interface ConfirmedEdge {
  parentId: string;
  childId: string;
}

// Commit result (requirement 9.3: partialChanges records what succeeded
// before a partial failure).
export type CommitResult =
  | { ok: true; changes: CommittedChange[] }
  | { ok: false; error: string; partialChanges: CommittedChange[] };

export interface CommittedChange {
  type: 'tech' | 'tech_keyword' | 'tech_parent' | 'keyword_bin';
  details: Record<string, string>;
  status: 'committed' | 'failed';
  error?: string;
}

const BASE = '/api/keyword-curation';

// Unmapped keyword queue (requirement 1.1, 1.2).
export const fetchQueue = async (): Promise<{ keywords: QueuedKeyword[] }> => {
  const { data } = await httpClient.get<{ keywords: QueuedKeyword[] }>(
    `${BASE}/queue`,
  );
  return data;
};

// Starts a curation session for one keyword; the graph runs up to its first
// interrupt() and the AI recommendation is returned for human review
// (requirement 2.1).
export const startSession = async (
  keyword: string,
): Promise<{ threadId: string; interrupt: AiRecommendation }> => {
  const { data } = await httpClient.post<{
    threadId: string;
    interrupt: AiRecommendation;
  }>(`${BASE}/session`, { keyword });
  return data;
};

// Resumes a curation session with the admin's decision; the graph runs to
// completion and commits the corresponding database writes (requirement 4.1,
// 5.2, 6.7, 7.2).
export const resumeSession = async (
  threadId: string,
  decision: HumanDecision,
): Promise<{ status: 'done'; result: CommitResult }> => {
  const { data } = await httpClient.post<{
    status: 'done';
    result: CommitResult;
  }>(`${BASE}/session/${encodeURIComponent(threadId)}/resume`, { decision });
  return data;
};
