import type { LlmClient } from '@codeshore/ai-client';
import type {
  CreateAiSuggestionInput,
  KeywordBinService,
  KeywordService,
  TechKeywordService,
  TechService,
} from '@codeshore/data-utils';

import type { AiSuggestionEvidence } from '../service';
import {
  findSimilarTech as defaultFindSimilarTech,
  SimilarityMatch,
} from '../validation/similarity-check';

import {
  emptyGeneratorResult,
  GeneratorProgress,
  GeneratorResult,
  SuggestionCreator,
  SuggestionGenerator,
} from './types';

/**
 * Minimum `keyword.count` for a keyword to be considered a candidate worth
 * including in the clustering prompt (requirement 3.1's "已達建議新增的門
 * 檻"). Deliberately the same conservative starting value as
 * `KeywordMappingGenerator.KEYWORD_COUNT_THRESHOLD` -- both generators
 * inspect the same "unmapped keyword" pool from a different angle (this one
 * asks "should a *new* tech exist for these", that one asks "does an
 * *existing* tech fit") -- but redeclared locally rather than imported from
 * `keyword-mapping.generator.ts`, since the two generators are independent
 * and must not depend on each other's internals. Exported so it is easy to
 * tune independently of the other generator's copy.
 */
export const KEYWORD_COUNT_THRESHOLD = 10;

/**
 * Similarity score (0..1, from `findSimilarTech`) at/above which an existing
 * `tech` entry is considered close enough to a proposed new entry's label to
 * be worth surfacing to the reviewer (requirement 3.2 / 8.4). This is a
 * "surface it" threshold, not a "block it" threshold -- matches at or above
 * this score are still attached to `evidence.similarItems` and the
 * suggestion is still created; the human reviewer decides whether the match
 * means "duplicate, reject" or "related but distinct, approve". Exported so
 * it is easy to tune once real label-similarity distributions are observed.
 */
export const SIMILARITY_THRESHOLD = 0.6;

export const TOOL_NAME = 'propose_tech_dictionary_changes';

export const INPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    newEntries: {
      type: 'array',
      description:
        'Zero or more new technology dictionary entries the candidate keyword set warrants. Each clusters one or more candidate keywords under a single proposed new tech. Return an empty array if none of the candidate keywords warrant a new entry.',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description:
              'Proposed stable slug id for the new tech entry (e.g. "solidjs").',
          },
          label: {
            type: 'string',
            description:
              'Proposed human-readable label for the new tech entry (e.g. "SolidJS").',
          },
          category: {
            type: 'string',
            description: 'Proposed category for the new tech entry.',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Proposed tags for the new tech entry.',
          },
          keywords: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Which of the input candidate keywords cluster under this proposed new tech entry.',
          },
          reasoning: {
            type: 'string',
            description:
              'One or two sentences explaining why these keywords cluster into this proposed new tech entry.',
          },
        },
        required: ['id', 'label', 'category'],
      },
    },
    updates: {
      type: 'array',
      description:
        'Zero or more proposed changes to existing tech dictionary entries whose category, tags, or icon look wrong or incomplete given how their mapped keywords are actually used. Return an empty array if none warrant a change.',
      items: {
        type: 'object',
        properties: {
          techId: {
            type: 'string',
            description: 'The "id" of the existing tech entry to update.',
          },
          category: {
            type: 'string',
            description:
              'Proposed new category, only present if it should change.',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Proposed new tags array, only present if it should change.',
          },
          iconSlugs: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Proposed new icon slugs array, only present if it should change.',
          },
          reasoning: {
            type: 'string',
            description:
              "One or two sentences explaining why this existing entry's category, tags, or icon should change.",
          },
        },
        required: ['techId', 'reasoning'],
      },
    },
  },
  required: ['newEntries', 'updates'],
};

/** An existing `tech` dictionary entry as sent to the LLM for clustering/review context. */
interface TechDictionaryContext {
  id: string;
  label: string;
  category: string;
  tags: string[];
}

interface NewTechEntryProposal {
  id: string;
  label: string;
  category: string;
  tags?: string[];
  keywords?: string[];
  reasoning?: string;
}

interface TechUpdateProposal {
  techId: string;
  category?: string;
  tags?: string[];
  iconSlugs?: string[];
  reasoning?: string;
}

interface TechDictionaryLlmResult extends Record<string, unknown> {
  newEntries?: NewTechEntryProposal[];
  updates?: TechUpdateProposal[];
}

export const SYSTEM_PROMPT = `You maintain a standardized technology dictionary built from keywords extracted from job descriptions.

You are given (1) a list of candidate keywords that occur frequently but do not map to any existing technology dictionary entry, and (2) the full existing technology dictionary (each entry has an "id", human-readable "label", "category", and "tags").

Do two things in a single pass:
1. Cluster the candidate keywords: propose zero or more brand-new technology dictionary entries that the candidate keyword set warrants, each with a proposed id/label/category/tags and the subset of candidate keywords that cluster under it. Do not force a new entry if the candidate keywords do not clearly warrant one.
2. Review the existing dictionary: propose zero or more updates to existing entries whose category, tags, or icon look wrong or incomplete.

Always include a short "reasoning" for each proposal.`;

/**
 * Requirement 3 (`tech_dictionary` workflow): finds keyword clusters that
 * cannot be mapped to any existing `tech` and proposes brand-new `tech`
 * entries for them (3.1), checking each proposed label against the existing
 * dictionary via `findSimilarTech` before creating the suggestion so
 * near-duplicates are surfaced to the reviewer rather than silently created
 * (3.2, 8.4). Also proposes `action='update'` suggestions for existing
 * `tech` entries whose category/tags/icon look wrong given how their mapped
 * keywords are actually used (3.3); update suggestions only ever touch the
 * `tech` row itself, never `tech_keyword`/`tech_parent`.
 */
export class TechDictionaryGenerator implements SuggestionGenerator {
  readonly workflow = 'tech_dictionary' as const;

  constructor(
    private readonly llmClient: LlmClient,
    private readonly keywordService: KeywordService,
    private readonly techKeywordService: TechKeywordService,
    private readonly techService: TechService,
    private readonly keywordBinService: KeywordBinService,
    private readonly suggestionCreator: SuggestionCreator,
    private readonly findSimilarTechFn: (
      candidateLabel: string,
      threshold: number,
    ) => Promise<readonly SimilarityMatch[]> = defaultFindSimilarTech,
  ) {}

  async *generate(): AsyncGenerator<GeneratorProgress, GeneratorResult> {
    const result = emptyGeneratorResult();

    const candidateKeywords = await this.selectCandidates();
    if (candidateKeywords.length === 0) {
      return result;
    }

    const { result: techRows } = await this.techService.fetchAll();
    const techEntries: TechDictionaryContext[] = techRows.map(tech => ({
      id: tech.id,
      label: tech.label,
      category: tech.category,
      tags: tech.tags ?? [],
    }));

    const completion =
      await this.llmClient.completeStructured<TechDictionaryLlmResult>({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: buildUserPrompt(candidateKeywords, techEntries),
        toolName: TOOL_NAME,
        inputSchema: INPUT_SCHEMA,
        input: { candidateKeywords, techEntries },
      });

    if (!completion.ok) {
      // Unlike `KeywordMappingGenerator` (one LLM call per candidate), this
      // generator makes exactly one LLM call for the whole batch -- a
      // failure here means the entire run produces nothing, not "continue
      // past this one failure".
      result.errors.push({
        message: `LLM tech-dictionary proposal failed: ${completion.error}`,
      });
      return result;
    }

    const { newEntries = [], updates = [] } = completion.result;

    for (const [index, entry] of newEntries.entries()) {
      yield {
        message: `Processing new tech entry ${index + 1}/${newEntries.length}: "${entry.id}"`,
      };
      await this.processNewEntry(entry, result);
    }
    for (const [index, update] of updates.entries()) {
      yield {
        message: `Processing tech update ${index + 1}/${updates.length}: "${update.techId}"`,
      };
      await this.processUpdate(update, result);
    }

    return result;
  }

  /**
   * Candidates = `keyword` rows at/above `KEYWORD_COUNT_THRESHOLD` whose id
   * does not already appear as a `keyword` on any `tech_keyword` row -- the
   * same "unmapped keyword" pool `KeywordMappingGenerator` inspects, computed
   * independently here (see `KEYWORD_COUNT_THRESHOLD`'s doc comment for why
   * this is duplicated rather than shared).
   */
  private async selectCandidates(): Promise<string[]> {
    const [{ result: keywords }, { result: techKeywords }, { result: keywordBinRows }] =
      await Promise.all([
        this.keywordService.fetchAll({ orders: [{ column: 'count', ascending: false }] }),
        this.techKeywordService.fetchAll(),
        this.keywordBinService.fetchAll(),
      ]);

    const alreadyMapped = new Set(techKeywords.map(row => row.keyword));
    const alreadyExcluded = new Set(keywordBinRows.map(row => row.id));

    return keywords
      .filter(
        keyword =>
          keyword.count >= KEYWORD_COUNT_THRESHOLD &&
          !alreadyMapped.has(keyword.id) &&
          !alreadyExcluded.has(keyword.id),
      )
      .map(keyword => keyword.id);
  }

  /**
   * Requirement 3.1/3.2/8.4: for a proposed new tech entry, look up similar
   * existing entries and attach them to `evidence.similarItems` (empty array
   * when none are found) before creating the `insert` suggestion. Similar
   * items found do NOT block creation -- the point is to let the human
   * reviewer decide, not to auto-reject (unlike `tech_parent` cycle
   * detection, which is a stricter, blocking case for a different reason).
   */
  private async processNewEntry(
    entry: NewTechEntryProposal,
    result: GeneratorResult,
  ): Promise<void> {
    const tags = entry.tags ?? [];
    const similarMatches = await this.findSimilarTechFn(
      entry.label,
      SIMILARITY_THRESHOLD,
    );
    const similarItems = similarMatches.map(match => ({
      id: match.id,
      label: match.label,
      score: match.score,
    }));

    const evidence: AiSuggestionEvidence = {
      reasoning:
        entry.reasoning ??
        `LLM proposed a new tech entry "${entry.label}" clustering keywords: ${(entry.keywords ?? []).join(', ') || '(none listed)'}`,
      similarItems,
    };

    const createInput: CreateAiSuggestionInput = {
      target_table: 'tech',
      workflow: 'tech_dictionary',
      action: 'insert',
      target_key: { id: entry.id },
      payload: {
        id: entry.id,
        category: entry.category,
        label: entry.label,
        tags,
      },
      evidence: evidence as unknown as Record<string, unknown>,
    };

    await this.createAndAggregate(createInput, entry.id, result);
  }

  /**
   * Requirement 3.3: for a proposed update to an existing tech entry, build
   * a payload containing only the fields the LLM actually proposed changing
   * (plus `id`) -- never `tech_keyword`/`tech_parent` fields, since an
   * `action='update'` suggestion against `target_table: 'tech'` can only
   * ever touch the `tech` row itself.
   */
  private async processUpdate(
    update: TechUpdateProposal,
    result: GeneratorResult,
  ): Promise<void> {
    const payload: Record<string, unknown> = { id: update.techId };
    if (update.category !== undefined) {
      payload['category'] = update.category;
    }
    if (update.tags !== undefined) {
      payload['tags'] = update.tags;
    }
    if (update.iconSlugs !== undefined) {
      payload['icon_slugs'] = update.iconSlugs;
    }

    const evidence: AiSuggestionEvidence = {
      reasoning:
        update.reasoning ??
        `LLM proposed updating tech "${update.techId}"`,
    };

    const createInput: CreateAiSuggestionInput = {
      target_table: 'tech',
      workflow: 'tech_dictionary',
      action: 'update',
      target_key: { id: update.techId },
      payload,
      evidence: evidence as unknown as Record<string, unknown>,
    };

    await this.createAndAggregate(createInput, update.techId, result);
  }

  private async createAndAggregate(
    createInput: CreateAiSuggestionInput,
    identifierForErrorMessage: string,
    result: GeneratorResult,
  ): Promise<void> {
    const createResult =
      await this.suggestionCreator.createSuggestion(createInput);

    switch (createResult.outcome) {
      case 'created':
        result.created++;
        break;
      case 'duplicate':
        result.skippedDuplicates++;
        break;
      case 'error':
        result.errors.push({
          message: `Failed to create suggestion for tech "${identifierForErrorMessage}": ${createResult.error.message}`,
        });
        break;
    }
  }
}

function buildUserPrompt(
  candidateKeywords: readonly string[],
  techEntries: readonly TechDictionaryContext[],
): string {
  const keywordList = candidateKeywords.map(keyword => `- "${keyword}"`).join('\n');
  const techList = techEntries
    .map(
      tech =>
        `- id: "${tech.id}", label: "${tech.label}", category: "${tech.category}", tags: [${tech.tags.map(tag => `"${tag}"`).join(', ')}]`,
    )
    .join('\n');
  return [
    'Candidate keywords (extracted from job descriptions, not yet mapped to any existing technology):',
    keywordList || '(none)',
    '',
    'Existing technology dictionary entries:',
    techList || '(none)',
    '',
    'Propose new tech dictionary entries clustering the candidate keywords, and/or updates to existing entries.',
  ].join('\n');
}
