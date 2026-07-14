import type { KeywordGroup } from '@codeshore/data-types';
import type { LlmClient } from './llm-client';

/**
 * A single line of a job description plus the rule-based extractor's
 * candidate keyword set for that line (requirements 3.1, 2.2 -- the
 * candidate set produced by `parseKeywordsOut` and its owning line's full
 * text are kept together so the AI can judge the candidates in context).
 *
 * `keywordCategoryMap` provides the keyword → category mapping built from
 * mv_tech; it is forwarded to the AI prompt so the model can assign each
 * group a category from the known vocabulary (requirement 2.2).
 */
export interface LineKeywordReviewInput {
  lineText: string;
  candidateKeywords: string[];
  /** keyword → category 對照表（從 mv_tech 建立）；用於 AI prompt 中說明分類詞彙。 */
  keywordCategoryMap: Record<string, string>;
}

export type LineKeywordReviewResult =
  | { ok: true; isCorrect: boolean; groups: KeywordGroup[]; reasoning: string }
  | { ok: false; error: string };

/** Fixed tool name for this reviewer's `LlmClient.completeStructured` call. */
export const TOOL_NAME = 'review_line_keywords';

export const INPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    isCorrect: {
      type: 'boolean',
      description:
        'true if the candidate keywords are complete and correct (no keyword added or removed). false if any correction was applied.',
    },
    groups: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Technology category from the provided mapping. Use "other" if not found.',
          },
          keywords: {
            type: 'array',
            items: { type: 'string' },
            description: 'Keywords in this OR group — any one of these satisfies the requirement.',
          },
        },
        required: ['category', 'keywords'],
      },
      description:
        'Grouped keyword result. Keywords that are alternatives belong in the same group (OR). Independently required keywords are in separate groups (AND between groups).',
    },
    reasoning: {
      type: 'string',
      description: 'One or two sentences explaining the grouping and any corrections applied.',
    },
  },
  required: ['isCorrect', 'groups', 'reasoning'],
};

interface LineKeywordReviewLlmResult extends Record<string, unknown> {
  isCorrect: boolean;
  groups: KeywordGroup[];
  reasoning: string;
}

export const SYSTEM_PROMPT = `You review keyword extraction results for a single line of a job description.

Given:
- One line of text from a job posting
- Candidate keywords extracted by a rule-based system
- A keyword-to-category mapping from the tech dictionary

Your task:
1. Verify or correct the candidate keywords.
2. Group the final keywords: keywords that are ALTERNATIVES (any one satisfies) go in the same group (OR). Keywords that are EACH INDEPENDENTLY required go in separate groups (AND between groups).
3. Assign each group a category using the provided mapping.

Examples:
  "Node.js 或 Golang" → groups: [{category:"backend_runtime", keywords:["node.js","golang"]}]
  "Node.js 和 Golang" → groups: [{category:"backend_runtime", keywords:["node.js"]}, {category:"backend_runtime", keywords:["golang"]}]
  "TypeScript, Vue.js 或 React.js" → groups: [{category:"language", keywords:["typescript"]}, {category:"frontend_framework", keywords:["vue.js","react.js"]}]

isCorrect is true when no keyword was added or removed (even if you still group and assign categories).`;

/**
 * Requirement 3 (逐行 AI 覆核): sends a single description line and its
 * rule-based candidate keyword set to the LLM via `LlmClient.completeStructured`,
 * asking it to confirm or adjust the candidate set (3.1) and group keywords by
 * OR/AND semantics with technology category labels (requirements 2.1–2.4).
 *
 * `completeStructured` never throws (see `llm-client.ts`'s `LlmClient` contract)
 * and neither does `review()` -- its `{ ok: false, error }` result is passed
 * straight through without any additional try/catch, leaving the
 * failure-vs-degrade decision (requirement 5) to the caller
 * (`generateJobKeywordsFromLines`).
 */
export class LineKeywordAiReviewer {
  constructor(private readonly llmClient: LlmClient) {}

  async review(input: LineKeywordReviewInput): Promise<LineKeywordReviewResult> {
    const completion = await this.llmClient.completeStructured<LineKeywordReviewLlmResult>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(input),
      toolName: TOOL_NAME,
      inputSchema: INPUT_SCHEMA,
      input,
    });

    if (!completion.ok) {
      return completion;
    }

    const { isCorrect, groups, reasoning } = completion.result;
    return { ok: true, isCorrect, groups, reasoning };
  }
}

function buildUserPrompt(input: LineKeywordReviewInput): string {
  const categoryLines = Object.entries(input.keywordCategoryMap)
    .map(([kw, cat]) => `  ${kw}: ${cat}`)
    .join('\n');

  return [
    `Line text: "${input.lineText}"`,
    '',
    `Candidate keywords: ${JSON.stringify(input.candidateKeywords)}`,
    '',
    'Keyword-to-category mapping:',
    categoryLines || '  (none)',
    '',
    'Review the candidate keywords, group them by OR/AND semantics, and assign each group a category.',
  ].join('\n');
}
