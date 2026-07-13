import type { LlmClient } from './llm-client';

/**
 * A single line of a job description plus the rule-based extractor's
 * candidate keyword set for that line (requirements 3.1, 2.2 -- the
 * candidate set produced by `parseKeywordsOut` and its owning line's full
 * text are kept together so the AI can judge the candidates in context).
 */
export interface LineKeywordReviewInput {
  lineText: string;
  candidateKeywords: string[];
}

export type LineKeywordReviewResult =
  | { ok: true; isCorrect: boolean; keywords: string[]; reasoning: string }
  | { ok: false; error: string };

/** Fixed tool name for this reviewer's `LlmClient.completeStructured` call. */
export const TOOL_NAME = 'review_line_keywords';

export const INPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    isCorrect: {
      type: 'boolean',
      description:
        'Whether the candidate keyword set correctly represents the technologies/skills mentioned in the line.',
    },
    keywords: {
      type: 'array',
      items: { type: 'string' },
      description:
        'The final keyword set for this line. Equal to the candidate set when isCorrect is true; the corrected set (additions/removals applied) when isCorrect is false.',
    },
    reasoning: {
      type: 'string',
      description: 'One or two sentences explaining the judgement.',
    },
  },
  required: ['isCorrect', 'keywords', 'reasoning'],
};

interface LineKeywordReviewLlmResult extends Record<string, unknown> {
  isCorrect: boolean;
  keywords: string[];
  reasoning: string;
}

export const SYSTEM_PROMPT = `You review keyword extraction results for a single line of a job description.

Given one line of text from a job posting and a candidate set of keywords that a rule-based extractor pulled from that line, decide whether the candidate set correctly represents the technologies/skills mentioned in that line.

- If the candidate keywords are correct, respond with isCorrect: true and keywords equal to the candidate set.
- If the candidate keywords are wrong -- missing a technology/skill that is mentioned, or including something that should not be there -- respond with isCorrect: false and keywords set to your corrected keyword set.
- Always include a short "reasoning" explaining the judgement.`;

/**
 * Requirement 3 (逐行 AI 覆核): sends a single description line and its
 * rule-based candidate keyword set to the LLM via `LlmClient.completeStructured`,
 * asking it to confirm or adjust the candidate set (3.1). `completeStructured`
 * never throws (see `llm-client.ts`'s `LlmClient` contract) and neither does
 * `review()` -- its `{ ok: false, error }` result is passed straight through
 * without any additional try/catch, leaving the failure-vs-degrade decision
 * (requirement 4) to the caller (`generateJobKeywordsFromLines`).
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

    const { isCorrect, keywords, reasoning } = completion.result;
    return { ok: true, isCorrect, keywords, reasoning };
  }
}

function buildUserPrompt(input: LineKeywordReviewInput): string {
  return [
    `Line text: "${input.lineText}"`,
    '',
    `Candidate keywords: ${JSON.stringify(input.candidateKeywords)}`,
    '',
    'Is this candidate keyword set correct for the line above?',
  ].join('\n');
}
