import type { AiSuggestionWorkflow } from '@codeshore/data-types';

import { httpClient } from '../../httpClient';

/**
 * 取得各資料庫物件的來源 SQL（物件名稱 -> CREATE 定義），
 * 由後端於建置時自 supabase/schema.sql 擷取。
 */
export const fetchMethodologySql = async () => {
  const res = await httpClient.get<Record<string, string>>(
    '/api/methodology/sql',
  );
  return res.data;
};

// Mirrors `apps/backend/src/features/ai-suggestion/workflow-info.ts`'s
// `WorkflowPromptStep`/`WorkflowInfo` exactly, same hand-mirroring convention
// as `ai-suggestion/service.ts`'s own `WorkflowPromptStep`/`WorkflowInfo`
// (no shared package for these backend-app-local types, so they're
// redeclared field-for-field here rather than imported).
export interface WorkflowPromptStep {
  stepLabel: string;
  toolName: string;
  systemPrompt: string;
  inputSchema: Record<string, unknown>;
}

// Mirrors `ai-suggestion/service.ts`'s `WorkflowInfo` exactly (see that
// file's own doc comment for the established precedent), renamed here to
// `AiSuggestionWorkflowInfo` to disambiguate from `KeywordCurationWorkflowInfo`
// within this shared `AiWorkflowsResponse` payload.
export interface AiSuggestionWorkflowInfo {
  workflow: AiSuggestionWorkflow;
  label: string;
  steps: readonly WorkflowPromptStep[];
}

// Mirrors `apps/backend/src/features/keyword-curation/workflow-info.ts`'s
// `CurationPathInfo` exactly, same hand-mirroring convention as above (the
// frontend cannot import backend code, so this is redeclared field-for-field
// here rather than imported).
export interface CurationPathInfo {
  path: 'A' | 'B' | 'C';
  label: string;
}

// Mirrors `apps/backend/src/features/keyword-curation/workflow-info.ts`'s
// `KeywordCurationWorkflowInfo` exactly, same hand-mirroring convention as
// above.
export interface KeywordCurationWorkflowInfo {
  toolName: string;
  systemPrompt: string;
  inputSchema: Record<string, unknown>;
  paths: readonly CurationPathInfo[];
}

// Mirrors `apps/backend/src/app/app.service.ts`'s `AiWorkflowsResponse`
// exactly: `AppService.getAiWorkflows()`'s aggregate return shape, combining
// `ai-suggestion/workflow-info.ts`'s `getWorkflowInfo()` output and
// `keyword-curation/workflow-info.ts`'s `getKeywordCurationWorkflowInfo()`
// output as-is (this codebase's established hand-mirroring convention for
// backend-app-local types, same as `AiSuggestionEvidence`/`AiSuggestionRecord`
// in `ai-suggestion/service.ts`).
export interface AiWorkflowsResponse {
  aiSuggestion: readonly AiSuggestionWorkflowInfo[];
  keywordCuration: KeywordCurationWorkflowInfo;
}

// `GET /methodology/ai-workflows`: the real, static LLM prompt
// templates/schemas that `ai-suggestion` and `keyword-curation` actually use
// at runtime, publicly exposed (透明度揭露，同本頁「資料來源 SQL」區塊的精神；
// requirement 2.1, 2.2, 3.1).
export const fetchAiWorkflows = async (): Promise<AiWorkflowsResponse> => {
  const res = await httpClient.get<AiWorkflowsResponse>(
    '/api/methodology/ai-workflows',
  );
  return res.data;
};
