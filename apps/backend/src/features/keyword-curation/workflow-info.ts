import { CLASSIFY_TOOL_INPUT_SCHEMA, SYSTEM_PROMPT, TOOL_NAME } from './llm-classifier';

/**
 * One decision path's transparency info: the path id (mirroring
 * `llm-classifier.ts`'s `CLASSIFY_TOOL_INPUT_SCHEMA.properties.path.enum`)
 * and its Chinese display label.
 */
export interface CurationPathInfo {
  path: 'A' | 'B' | 'C';
  label: string;
}

/**
 * The keyword-curation workflow's transparency info: the single LLM
 * classifier call's real, static prompt/schema, as actually used by
 * `CurationLlmClassifier` at runtime, plus the three decision paths it can
 * choose between (requirement: 讓一般訪客理解 keyword 策展工作流的引導式流程
 * 與三個決策路徑，以及 AI 分類器實際使用的 system prompt 與工具 schema).
 */
export interface KeywordCurationWorkflowInfo {
  toolName: string;
  systemPrompt: string;
  inputSchema: Record<string, unknown>;
  paths: readonly CurationPathInfo[];
}

/**
 * Chinese display labels for each decision path.
 */
const PATH_LABELS: Record<CurationPathInfo['path'], string> = {
  A: '映射至既有技術條目',
  B: '建立新技術條目',
  C: '移入 keyword bin',
};

/**
 * Assembles the real, static prompt/schema for the keyword-curation
 * classifier directly from `llm-classifier.ts`'s own exported constants --
 * never a copy or a paraphrase -- so this can never drift out of sync with
 * what actually runs at classification time (the same "single source of
 * truth" transparency philosophy as
 * `apps/backend/src/features/ai-suggestion/workflow-info.ts`'s
 * `getWorkflowInfo()`, which does the same for its own generators). Pure and
 * synchronous: no DB call, no LLM call, no dependency on `libs/data-utils`.
 */
export function getKeywordCurationWorkflowInfo(): KeywordCurationWorkflowInfo {
  return {
    toolName: TOOL_NAME,
    systemPrompt: SYSTEM_PROMPT,
    inputSchema: CLASSIFY_TOOL_INPUT_SCHEMA,
    paths: [
      { path: 'A', label: PATH_LABELS.A },
      { path: 'B', label: PATH_LABELS.B },
      { path: 'C', label: PATH_LABELS.C },
    ],
  };
}
