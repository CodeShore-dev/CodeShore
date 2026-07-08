import type { AiSuggestionWorkflow } from '@codeshore/data-types';

import {
  INPUT_SCHEMA as KEYWORD_MAPPING_INPUT_SCHEMA,
  SYSTEM_PROMPT as KEYWORD_MAPPING_SYSTEM_PROMPT,
  TOOL_NAME as KEYWORD_MAPPING_TOOL_NAME,
} from './generators/keyword-mapping.generator';
import {
  INPUT_SCHEMA as LOCATION_MAPPING_INPUT_SCHEMA,
  SYSTEM_PROMPT as LOCATION_MAPPING_SYSTEM_PROMPT,
  TOOL_NAME as LOCATION_MAPPING_TOOL_NAME,
} from './generators/location-mapping.generator';
import {
  DESCRIPTION_PATTERN_INPUT_SCHEMA,
  DESCRIPTION_PATTERN_SYSTEM_PROMPT,
  DESCRIPTION_PATTERN_TOOL_NAME,
  KEYWORD_NOISE_INPUT_SCHEMA,
  KEYWORD_NOISE_SYSTEM_PROMPT,
  KEYWORD_NOISE_TOOL_NAME,
} from './generators/noise-detection.generator';
import {
  INPUT_SCHEMA as TECH_DICTIONARY_INPUT_SCHEMA,
  SYSTEM_PROMPT as TECH_DICTIONARY_SYSTEM_PROMPT,
  TOOL_NAME as TECH_DICTIONARY_TOOL_NAME,
} from './generators/tech-dictionary.generator';
import {
  INPUT_SCHEMA as TECH_HIERARCHY_INPUT_SCHEMA,
  SYSTEM_PROMPT as TECH_HIERARCHY_SYSTEM_PROMPT,
  TOOL_NAME as TECH_HIERARCHY_TOOL_NAME,
} from './generators/tech-hierarchy.generator';

/**
 * A single LLM call's real, static prompt/schema, as actually used by a
 * generator at runtime (requirement: 讓維運者在審核頁看到每個子工作流實際使用
 * 的 LLM system prompt template 與預期輸出 tool/schema). 4 of the 5
 * workflows make exactly one LLM call and so have exactly one step;
 * `noise_detection` makes two independent calls (see
 * `generators/noise-detection.generator.ts`'s doc comment) and so has two.
 */
export interface WorkflowPromptStep {
  /** Chinese label identifying this step within its workflow. */
  stepLabel: string;
  toolName: string;
  systemPrompt: string;
  inputSchema: Record<string, unknown>;
}

/**
 * One sub-workflow's transparency info: its display label (mirroring
 * `apps/frontend/src/features/ai-suggestion/constants.ts`'s
 * `WORKFLOW_LABELS`, so the review page's workflow selector and this
 * transparency panel never show different names for the same workflow) and
 * its one-or-two LLM-call steps.
 */
export interface WorkflowInfo {
  workflow: AiSuggestionWorkflow;
  label: string;
  steps: readonly WorkflowPromptStep[];
}

/**
 * Chinese display labels for each workflow, kept identical to
 * `apps/frontend/src/features/ai-suggestion/constants.ts`'s
 * `WORKFLOW_LABELS` by convention (the frontend cannot import backend code,
 * so this is hand-mirrored the same way `AiSuggestionEvidence`/
 * `AiSuggestionRecord` already are between the two `service.ts` files --
 * see that file's own doc comment for the established precedent).
 */
const WORKFLOW_LABELS: Record<AiSuggestionWorkflow, string> = {
  keyword_mapping: '關鍵字對應技術',
  tech_dictionary: '技術字典補全',
  tech_hierarchy: '技術父子階層',
  location_mapping: '地點正規化',
  noise_detection: '排除清單雜訊偵測',
};

/**
 * Assembles the real, static prompt/schema for every sub-workflow directly
 * from each generator's own exported constants -- never a copy or a
 * paraphrase -- so this can never drift out of sync with what actually runs
 * at generation time (the same "single source of truth" transparency
 * philosophy as `apps/frontend/src/features/methodology/pages/MethodologyPage.tsx`'s
 * "資料來源 SQL" section, which extracts real SQL from `schema.sql` rather
 * than hand-copying it). Pure and synchronous: no DB call, no LLM call, no
 * dependency on `libs/data-utils`.
 */
export function getWorkflowInfo(): readonly WorkflowInfo[] {
  return [
    {
      workflow: 'keyword_mapping',
      label: WORKFLOW_LABELS.keyword_mapping,
      steps: [
        {
          stepLabel: '關鍵字→技術映射',
          toolName: KEYWORD_MAPPING_TOOL_NAME,
          systemPrompt: KEYWORD_MAPPING_SYSTEM_PROMPT,
          inputSchema: KEYWORD_MAPPING_INPUT_SCHEMA,
        },
      ],
    },
    {
      workflow: 'tech_dictionary',
      label: WORKFLOW_LABELS.tech_dictionary,
      steps: [
        {
          stepLabel: '技術字典補全與修正',
          toolName: TECH_DICTIONARY_TOOL_NAME,
          systemPrompt: TECH_DICTIONARY_SYSTEM_PROMPT,
          inputSchema: TECH_DICTIONARY_INPUT_SCHEMA,
        },
      ],
    },
    {
      workflow: 'tech_hierarchy',
      label: WORKFLOW_LABELS.tech_hierarchy,
      steps: [
        {
          stepLabel: '技術父子階層提案',
          toolName: TECH_HIERARCHY_TOOL_NAME,
          systemPrompt: TECH_HIERARCHY_SYSTEM_PROMPT,
          inputSchema: TECH_HIERARCHY_INPUT_SCHEMA,
        },
      ],
    },
    {
      workflow: 'location_mapping',
      label: WORKFLOW_LABELS.location_mapping,
      steps: [
        {
          stepLabel: '地點字串正規化',
          toolName: LOCATION_MAPPING_TOOL_NAME,
          systemPrompt: LOCATION_MAPPING_SYSTEM_PROMPT,
          inputSchema: LOCATION_MAPPING_INPUT_SCHEMA,
        },
      ],
    },
    {
      workflow: 'noise_detection',
      label: WORKFLOW_LABELS.noise_detection,
      steps: [
        {
          stepLabel: '關鍵字雜訊偵測',
          toolName: KEYWORD_NOISE_TOOL_NAME,
          systemPrompt: KEYWORD_NOISE_SYSTEM_PROMPT,
          inputSchema: KEYWORD_NOISE_INPUT_SCHEMA,
        },
        {
          stepLabel: '職缺描述樣式偵測',
          toolName: DESCRIPTION_PATTERN_TOOL_NAME,
          systemPrompt: DESCRIPTION_PATTERN_SYSTEM_PROMPT,
          inputSchema: DESCRIPTION_PATTERN_INPUT_SCHEMA,
        },
      ],
    },
  ];
}
