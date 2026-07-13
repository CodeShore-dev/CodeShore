import { Injectable } from '@nestjs/common';

import type { LlmClient } from '@codeshore/ai-client';

import type { AiRecommendation, SuggestedEdge, SuggestedNewTech, TechOption } from './graph.types';

/**
 * design.md's `CurationLlmClassifier` LLM tool. The model is forced (via
 * `LlmClient.completeStructured`'s `toolChoice`) to respond with exactly
 * this tool call, so a successful completion is guaranteed to be
 * schema-shaped rather than free-form text.
 */
export const TOOL_NAME = 'classify_keyword';

/**
 * Exact schema from design.md's `CLASSIFY_TOOL_INPUT_SCHEMA` -- do not
 * diverge from this shape; other tasks (3.2's `classify` node, the frontend
 * `AiRecommendationCard`) depend on the field names matching design.md
 * verbatim.
 */
export const CLASSIFY_TOOL_INPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    path: {
      type: 'string',
      enum: ['A', 'B', 'C'],
      description: 'A=map to existing tech, B=create new tech, C=keyword_bin',
    },
    // Path A fields
    matchedTechId: { type: ['string', 'null'], description: 'Existing tech id (path A)' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    // Path B fields
    suggestedId: { type: ['string', 'null'], description: 'Proposed slug id for new tech' },
    suggestedLabel: { type: ['string', 'null'], description: 'Proposed display label' },
    suggestedCategory: { type: ['string', 'null'], description: 'Proposed category' },
    suggestedTags: { type: 'array', items: { type: 'string' } },
    suggestedEdges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['parent', 'child'] },
          techId: { type: 'string' },
          reasoning: { type: 'string' },
        },
        required: ['type', 'techId', 'reasoning'],
      },
    },
    // Common
    reasoning: { type: 'string' },
  },
  required: ['path', 'reasoning'],
};

export const SYSTEM_PROMPT = `You classify keywords extracted from job descriptions against an existing, standardized technology dictionary, choosing exactly one of three paths.

You will be given a candidate keyword, the number of job postings it appears in, and a list of existing technology dictionary entries (each with an "id", human-readable "label", and "category").

Decide which of these three paths applies, and call the "classify_keyword" tool with the corresponding fields:

- Path A ("map to existing tech"): the keyword is a synonym, alias, abbreviation, or otherwise clearly refers to exactly one existing entry. Respond with path: "A", matchedTechId set to that entry's "id", and a confidence score between 0 and 1 reflecting how certain you are of the match. Always include your best-guess match with an honest confidence score, even if that confidence is low -- do not omit matchedTechId just because you are unsure.
- Path B ("create new tech entry"): the keyword refers to a real, distinct technology that is not adequately covered by any existing entry. Respond with path: "B", plus suggestedId (a URL-safe slug), suggestedLabel (a human-readable display name), suggestedCategory (a category consistent with the existing entries' categories), and optionally suggestedTags (an array of short lowercase tags). If the new technology has an obvious parent or child relationship to one or more existing entries (e.g. a framework built on top of an existing language, or a broader existing category encompassing this new entry), also include suggestedEdges: an array of { type: "parent" | "child", techId: <existing entry's id>, reasoning } describing each such relationship. If there is no clear parent/child relationship, omit suggestedEdges or leave it empty.
- Path C ("noise / not a technology"): the keyword does not clearly refer to any real, specific technology (e.g. a typo, a generic English word, a company name, or otherwise not something that belongs in a technology dictionary). Respond with path: "C" only.

In every case, always include a "reasoning" field: one or two sentences explaining why you chose that path.`;

interface ClassifyToolEdgeResult {
  type?: unknown;
  techId?: unknown;
  reasoning?: unknown;
}

interface ClassifyToolResult extends Record<string, unknown> {
  path?: unknown;
  matchedTechId?: unknown;
  confidence?: unknown;
  suggestedId?: unknown;
  suggestedLabel?: unknown;
  suggestedCategory?: unknown;
  suggestedTags?: unknown;
  suggestedEdges?: unknown;
  reasoning?: unknown;
}

/**
 * design.md's `CurationLlmClassifier` (requirement 3.1-3.5): asks the LLM to
 * classify a keyword into path A/B/C via the `classify_keyword` tool, and
 * turns the tool response into a validated `AiRecommendation`.
 *
 * `classify()` never throws: any thrown error, any `completion.ok === false`
 * result, and any malformed/unexpected tool response (missing required
 * fields for the reported path, a `matchedTechId`/edge `techId` that doesn't
 * resolve against `allTechs`, or an unrecognized `path` value) is converted
 * into `{ path: 'ai_failed', error }` instead (requirement 3.5, 9.2) -- the
 * `classify` LangGraph node (task 3.2) relies on this to safely `interrupt()`
 * with a degraded-mode payload rather than crashing the graph run.
 */
@Injectable()
export class CurationLlmClassifier {
  constructor(private readonly llmClient: LlmClient) {}

  async classify(
    keyword: string,
    affectedJobCount: number,
    allTechs: readonly TechOption[],
  ): Promise<AiRecommendation> {
    try {
      const completion = await this.llmClient.completeStructured<ClassifyToolResult>({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: buildUserPrompt(keyword, affectedJobCount, allTechs),
        toolName: TOOL_NAME,
        inputSchema: CLASSIFY_TOOL_INPUT_SCHEMA,
        input: { keyword, affectedJobCount, allTechs },
      });

      if (!completion.ok) {
        return { path: 'ai_failed', error: completion.error };
      }

      return toRecommendation(completion.result, keyword, affectedJobCount, allTechs);
    } catch (error) {
      return { path: 'ai_failed', error: toErrorMessage(error) };
    }
  }
}

function toRecommendation(
  result: ClassifyToolResult,
  keyword: string,
  affectedJobCount: number,
  allTechs: readonly TechOption[],
): AiRecommendation {
  if (typeof result.reasoning !== 'string') {
    return {
      path: 'ai_failed',
      error: `LLM tool response for keyword "${keyword}" was missing a "reasoning" string`,
    };
  }
  const reasoning = result.reasoning;

  switch (result.path) {
    case 'A':
      return toPathA(result, keyword, reasoning, affectedJobCount, allTechs);
    case 'B':
      return toPathB(result, keyword, reasoning, affectedJobCount, allTechs);
    case 'C':
      return { path: 'C', reasoning, affectedJobCount };
    default:
      return {
        path: 'ai_failed',
        error: `LLM tool response for keyword "${keyword}" had an unrecognized "path" value: ${JSON.stringify(result.path)}`,
      };
  }
}

function toPathA(
  result: ClassifyToolResult,
  keyword: string,
  reasoning: string,
  affectedJobCount: number,
  allTechs: readonly TechOption[],
): AiRecommendation {
  if (typeof result.matchedTechId !== 'string' || typeof result.confidence !== 'number') {
    return {
      path: 'ai_failed',
      error: `LLM tool response for keyword "${keyword}" reported path A but was missing a valid matchedTechId/confidence`,
    };
  }

  const matchedTech = allTechs.find(tech => tech.id === result.matchedTechId);
  if (!matchedTech) {
    return {
      path: 'ai_failed',
      error: `LLM tool response for keyword "${keyword}" reported matchedTechId "${result.matchedTechId}" which does not exist in the provided tech list`,
    };
  }

  return {
    path: 'A',
    matchedTech: { id: matchedTech.id, label: matchedTech.label, category: matchedTech.category },
    confidence: result.confidence,
    reasoning,
    affectedJobCount,
  };
}

function toPathB(
  result: ClassifyToolResult,
  keyword: string,
  reasoning: string,
  affectedJobCount: number,
  allTechs: readonly TechOption[],
): AiRecommendation {
  if (
    typeof result.suggestedId !== 'string' ||
    typeof result.suggestedLabel !== 'string' ||
    typeof result.suggestedCategory !== 'string'
  ) {
    return {
      path: 'ai_failed',
      error: `LLM tool response for keyword "${keyword}" reported path B but was missing a valid suggestedId/suggestedLabel/suggestedCategory`,
    };
  }

  const suggestedTags = Array.isArray(result.suggestedTags)
    ? result.suggestedTags.filter((tag): tag is string => typeof tag === 'string')
    : [];

  const suggestedTech: SuggestedNewTech = {
    id: result.suggestedId,
    label: result.suggestedLabel,
    category: result.suggestedCategory,
    tags: suggestedTags,
    // design.md: SuggestedNewTech.iconSlugs defaults to [] (admin fills in later in the frontend).
    iconSlugs: [],
  };

  const rawEdges = Array.isArray(result.suggestedEdges) ? result.suggestedEdges : [];
  const suggestedEdges: SuggestedEdge[] = [];
  for (const rawEdge of rawEdges as ClassifyToolEdgeResult[]) {
    const edge = resolveEdge(rawEdge, keyword, allTechs);
    if ('error' in edge) {
      return { path: 'ai_failed', error: edge.error };
    }
    suggestedEdges.push(edge.value);
  }

  return { path: 'B', suggestedTech, suggestedEdges, reasoning, affectedJobCount };
}

function resolveEdge(
  rawEdge: ClassifyToolEdgeResult,
  keyword: string,
  allTechs: readonly TechOption[],
): { value: SuggestedEdge } | { error: string } {
  if (rawEdge.type !== 'parent' && rawEdge.type !== 'child') {
    return {
      error: `LLM tool response for keyword "${keyword}" included a suggestedEdges entry with an invalid type: ${JSON.stringify(rawEdge.type)}`,
    };
  }
  if (typeof rawEdge.techId !== 'string') {
    return {
      error: `LLM tool response for keyword "${keyword}" included a suggestedEdges entry without a valid techId`,
    };
  }
  if (typeof rawEdge.reasoning !== 'string') {
    return {
      error: `LLM tool response for keyword "${keyword}" included a suggestedEdges entry without a valid reasoning`,
    };
  }
  const tech = allTechs.find(candidate => candidate.id === rawEdge.techId);
  if (!tech) {
    return {
      error: `LLM tool response for keyword "${keyword}" included a suggestedEdges entry with techId "${rawEdge.techId}" which does not exist in the provided tech list`,
    };
  }
  return {
    value: { type: rawEdge.type, techId: tech.id, techLabel: tech.label, reasoning: rawEdge.reasoning },
  };
}

function buildUserPrompt(
  keyword: string,
  affectedJobCount: number,
  allTechs: readonly TechOption[],
): string {
  const techList = allTechs
    .map(tech => `- id: "${tech.id}", label: "${tech.label}", category: "${tech.category}"`)
    .join('\n');
  return [
    `Candidate keyword (extracted from job descriptions): "${keyword}"`,
    `Number of job postings this keyword appears in: ${affectedJobCount}`,
    '',
    'Existing technology dictionary entries:',
    techList || '(none)',
    '',
    'Classify this keyword into path A, B, or C.',
  ].join('\n');
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
