import type { KeywordGroup } from '@codeshore/data-types';

import { ServiceLogger, OutboundLogger } from '@codeshore/service-logger';
import type { LlmClient } from './llm-client';

export interface LineKeywordReviewInput {
  lineText: string;
  /** Unique technology category names from mv_tech — constrains the AI's category vocabulary. */
  categories: string[];
}

export type LineKeywordReviewResult =
  | { ok: true; groups: KeywordGroup[]; reasoning: string }
  | { ok: false; error: string };

/** Fixed tool name for this reviewer's `LlmClient.completeStructured` call. */
export const TOOL_NAME = 'review_line_keywords';

export const INPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    groups: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Technology category from the provided list. Use "other" if none fits.',
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
        'Grouped keyword result. Keywords that are alternatives belong in the same group (OR). Independently required keywords are in separate groups (AND between groups). Return an empty array if no tech keywords are present.',
    },
    reasoning: {
      type: 'string',
      description: 'One or two sentences explaining what keywords were found and how they were grouped.',
    },
  },
  required: ['groups', 'reasoning'],
};

interface LineKeywordReviewLlmResult extends Record<string, unknown> {
  groups: KeywordGroup[];
  reasoning: string;
}

export const SYSTEM_PROMPT = `You identify technology keywords in a single line from a job description.

Given:
- One line of text from a job posting
- A list of available technology category names

Your task:
1. Identify ALL technology keywords mentioned in the line (frameworks, languages, tools, databases, platforms, etc.).
2. Group the keywords: keywords that are ALTERNATIVES (any one satisfies) go in the same group (OR). Keywords that are EACH INDEPENDENTLY required go in separate groups (AND between groups).
3. Assign each group a category from the provided list. Use "other" if none fits.
4. If the line contains no technology keywords, return an empty groups array.

Examples:
  "Node.js 或 Golang" → groups: [{category:"backend_runtime", keywords:["node.js","golang"]}]
  "Node.js 和 Golang" → groups: [{category:"backend_runtime", keywords:["node.js"]}, {category:"backend_runtime", keywords:["golang"]}]
  "TypeScript, Vue.js 或 React.js" → groups: [{category:"language", keywords:["typescript"]}, {category:"frontend_framework", keywords:["vue.js","react.js"]}]
  "具備良好溝通能力" → groups: []`;

export class LineKeywordAiReviewer {
  constructor(
    private readonly llmClient: LlmClient,
    private readonly logger?: ServiceLogger,
  ) {}

  async review(input: LineKeywordReviewInput): Promise<LineKeywordReviewResult> {
    const logger = this.logger ? new OutboundLogger(this.logger) : undefined;

    const logRequest = logger?.logRequest({
      name: 'LineKeywordAiReviewer.review',
      body: input,
    });

    const completion = await this.llmClient.completeStructured<LineKeywordReviewLlmResult>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(input),
      toolName: TOOL_NAME,
      inputSchema: INPUT_SCHEMA,
      input,
    });

    if (!completion.ok) {
      logRequest?.logException(completion.error);
      return completion;
    }

    logRequest?.logResponse({
      data: completion.result,
      status: 200,
    });

    const { groups, reasoning } = completion.result;
    return { ok: true, groups, reasoning };
  }
}

function buildUserPrompt(input: LineKeywordReviewInput): string {
  const categoryList = input.categories.length > 0 ? input.categories.join(', ') : '(none)';

  return [
    `Line: "${input.lineText}"`,
    '',
    `Available categories: ${categoryList}`,
    '',
    'Identify technology keywords in this line, group them by OR/AND semantics, and assign each group a category.',
  ].join('\n');
}

