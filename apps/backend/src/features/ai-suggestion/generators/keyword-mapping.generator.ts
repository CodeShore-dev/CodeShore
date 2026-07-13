import type { LlmClient } from '@codeshore/ai-client';
import type {
  CreateAiSuggestionInput,
  JobKeywordService,
  KeywordBinService,
  KeywordService,
  TechKeywordService,
  TechService,
} from '@codeshore/data-utils';

import type { AiSuggestionEvidence } from '../service';

import {
  emptyGeneratorResult,
  GeneratorProgress,
  GeneratorResult,
  SuggestionCreator,
  SuggestionGenerator,
} from './types';

/**
 * Minimum `keyword.count` (raw occurrence count across job postings, see
 * `libs/data-utils/src/lib/api/keyword.service.ts`) for a keyword to be
 * considered "已達一定出現頻率" (requirement 2.1) and worth spending an LLM
 * call classifying. Chosen as a conservative starting point: low enough to
 * still surface real but less-common technologies, high enough to skip
 * one-off typos/noise that only ever appear in a handful of job postings.
 * Exported so it is easy to tune once real keyword-count distributions are
 * observed in production.
 */
export const KEYWORD_COUNT_THRESHOLD = 10;

/**
 * Confidence score (0..1, from the LLM's `confidence`) below which a
 * mapping suggestion is flagged `evidence.needsVerification = true` rather
 * than being treated as a high-confidence, fast-to-review suggestion
 * (requirement 8.1: "信心分數低於預先定義門檻的建議需標示為『需人工額外查
 * 證』"). Exported so it is easy to tune independently of
 * `KEYWORD_COUNT_THRESHOLD`.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

export const TOOL_NAME = 'classify_keyword_to_tech';

export const INPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    matchedTechId: {
      type: ['string', 'null'],
      description:
        'The "id" of the existing tech dictionary entry this keyword should map to, or null if none of the provided entries are a suitable match.',
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description:
        'Confidence (0..1) that matchedTechId is correct. Required whenever matchedTechId is not null.',
    },
    suggestedCategory: {
      type: 'string',
      description:
        'Required whenever matchedTechId is null: a proposed category for a brand-new tech dictionary entry that would use the keyword itself as both its id and label, so a reviewer can choose to create that entry instead of marking the keyword as noise.',
    },
    reasoning: {
      type: 'string',
      description:
        'One or two sentences explaining the classification decision (why this tech was chosen, or why none fit).',
    },
  },
  required: ['matchedTechId', 'reasoning'],
};

/** A single `tech` dictionary entry as sent to the LLM for classification context. */
interface TechClassificationContext {
  id: string;
  label: string;
  category: string;
}

interface KeywordMappingLlmResult extends Record<string, unknown> {
  matchedTechId: string | null;
  confidence?: number;
  suggestedCategory?: string;
  reasoning?: string;
}

export const SYSTEM_PROMPT = `You classify keywords extracted from job descriptions against an existing, standardized technology dictionary.

Given a candidate keyword and a list of existing technology dictionary entries (each with an "id", human-readable "label", and "category"), decide whether the keyword is a synonym, alias, abbreviation, or otherwise clearly refers to one of the existing entries.

- If exactly one existing entry is a clear match, respond with that entry's "id" as matchedTechId and a confidence score between 0 and 1.
- If no existing entry is a suitable match, respond with matchedTechId: null, and also include a suggestedCategory: a proposed category for a brand-new tech dictionary entry that would use the keyword itself as both its id and label. A human reviewer will then choose between creating that new entry or marking the keyword as noise instead -- do not decide between those two outcomes yourself.
- Always include a short "reasoning" explaining the decision.`;

/**
 * Requirement 2 (`tech_keyword` workflow): finds keywords that occur
 * frequently enough to matter but are not yet covered by any `tech_keyword`
 * mapping, asks the LLM whether each should map to an existing `tech`, and
 * creates a `pending` `keyword_mapping` suggestion for confident matches
 * (2.1). Each created match suggestion carries the LLM's confidence, a
 * `needsVerification` flag for low-confidence matches (8.1), and an
 * estimate of how many jobs would be affected by adopting the mapping
 * (2.3).
 *
 * Keywords the LLM judges as having no suitable existing match (2.2) are
 * never forced onto the closest entry, and never silently dropped either:
 * instead this creates two mutually-exclusive suggestion options so a human
 * reviewer can choose between them (approving one and rejecting the other) --
 * see `processNoMatch` for exactly what each option creates. This mirrors
 * `LocationMappingGenerator`'s "no existing group fits" case, which always
 * resolves into an actionable suggestion rather than a bare skip.
 */
export class KeywordMappingGenerator implements SuggestionGenerator {
  readonly workflow = 'keyword_mapping' as const;

  constructor(
    private readonly llmClient: LlmClient,
    private readonly keywordService: KeywordService,
    private readonly techKeywordService: TechKeywordService,
    private readonly techService: TechService,
    private readonly jobKeywordService: JobKeywordService,
    private readonly keywordBinService: KeywordBinService,
    private readonly suggestionCreator: SuggestionCreator,
  ) {}

  async *generate(): AsyncGenerator<GeneratorProgress, GeneratorResult> {
    const result = emptyGeneratorResult();

    const candidateKeywords = await this.selectCandidates();
    if (candidateKeywords.length === 0) {
      return result;
    }

    const { result: techRows } = await this.techService.fetchAll();
    const techEntries: TechClassificationContext[] = techRows.map(tech => ({
      id: tech.id,
      label: tech.label,
      category: tech.category,
    }));

    for (const [index, candidateKeyword] of candidateKeywords.entries()) {
      yield {
        message: `Classifying keyword ${index + 1}/${candidateKeywords.length}: "${candidateKeyword}"`,
      };
      await this.processCandidate(candidateKeyword, techEntries, result);
    }

    return result;
  }

  /**
   * Candidates = `keyword` rows at/above `KEYWORD_COUNT_THRESHOLD` whose id
   * (the keyword text itself, per `keyword.service.ts`) does not already
   * appear as a `keyword` on any `tech_keyword` row, AND is not already in
   * `keyword_bin` -- a keyword a reviewer previously excluded as noise (via
   * this generator's own "放入 keyword_bin" option below, or via
   * `NoiseDetectionGenerator`) must not keep coming back as a candidate on
   * every subsequent run.
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

  private async processCandidate(
    candidateKeyword: string,
    techEntries: readonly TechClassificationContext[],
    result: GeneratorResult,
  ): Promise<void> {
    const completion =
      await this.llmClient.completeStructured<KeywordMappingLlmResult>({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: buildUserPrompt(candidateKeyword, techEntries),
        toolName: TOOL_NAME,
        inputSchema: INPUT_SCHEMA,
        input: { keyword: candidateKeyword, techEntries },
      });

    if (!completion.ok) {
      // One candidate's LLM call failing must not abort the batch -- the
      // rest of the candidates still get processed.
      result.errors.push({
        message: `LLM classification failed for keyword "${candidateKeyword}": ${completion.error}`,
      });
      return;
    }

    const { matchedTechId, confidence, suggestedCategory, reasoning } =
      completion.result;

    if (!matchedTechId) {
      await this.processNoMatch(
        candidateKeyword,
        suggestedCategory,
        reasoning,
        result,
      );
      return;
    }

    const affectedCount = await this.countAffectedJobs(candidateKeyword);
    const needsVerification =
      typeof confidence === 'number' && confidence < LOW_CONFIDENCE_THRESHOLD;

    const evidence: AiSuggestionEvidence = {
      reasoning:
        reasoning ??
        `LLM matched keyword "${candidateKeyword}" to tech "${matchedTechId}"`,
      confidence,
      needsVerification,
      affectedCount,
    };

    const createInput: CreateAiSuggestionInput = {
      target_table: 'tech_keyword',
      workflow: 'keyword_mapping',
      action: 'insert',
      target_key: { tech: matchedTechId, keyword: candidateKeyword },
      payload: { tech: matchedTechId, keyword: candidateKeyword },
      // `CreateAiSuggestionInput.evidence` is the data-utils layer's untyped
      // `jsonb` shape (`Record<string, unknown>`); `AiSuggestionEvidence`'s
      // fields are all individually assignable to `unknown` but TS still
      // requires an explicit signature-widening cast here, same as
      // `service.ts`'s `outcome as unknown as Record<string, unknown>`.
      evidence: evidence as unknown as Record<string, unknown>,
    };

    await this.createAndAggregate(
      createInput,
      `keyword "${candidateKeyword}"`,
      result,
    );
  }

  /**
   * Requirement 2.2: when the LLM finds no existing tech match, create two
   * mutually-exclusive suggestion options instead of silently skipping -- a
   * reviewer approves whichever they want and rejects the other:
   *
   * 1. A linked pair sharing a `correlationId` (mirroring
   *    `LocationMappingGenerator`'s new-group + new-mapping pairing): a new
   *    `tech` entry using the keyword itself, verbatim, as both `id` and
   *    `label`, plus the `tech_keyword` mapping from the keyword to that new
   *    entry. `tech.category` is `NOT NULL`, so this option is only created
   *    when the LLM actually supplied a `suggestedCategory`; if it didn't,
   *    this option is skipped and recorded as an error (a prompt-contract
   *    violation), while the keyword_bin option below is still created.
   * 2. A `keyword_bin` insert marking the keyword as noise -- permanently
   *    excluded from future `selectCandidates()` runs via the
   *    `keyword_bin`-exclusion check there.
   */
  private async processNoMatch(
    candidateKeyword: string,
    suggestedCategory: string | undefined,
    reasoning: string | undefined,
    result: GeneratorResult,
  ): Promise<void> {
    const baseReasoning =
      reasoning ??
      `LLM found no existing tech match for keyword "${candidateKeyword}"`;
    const affectedCount = await this.countAffectedJobs(candidateKeyword);

    if (suggestedCategory) {
      const correlationId = crypto.randomUUID();

      const newTechInput: CreateAiSuggestionInput = {
        target_table: 'tech',
        workflow: 'keyword_mapping',
        action: 'insert',
        target_key: { id: candidateKeyword },
        payload: {
          id: candidateKeyword,
          label: candidateKeyword,
          category: suggestedCategory,
        },
        evidence: {
          reasoning: `${baseReasoning}（選項一：以此關鍵字建立新技術項目）`,
          affectedCount,
          correlationId,
        } as unknown as Record<string, unknown>,
      };
      await this.createAndAggregate(
        newTechInput,
        `tech "${candidateKeyword}"`,
        result,
      );

      const newMappingInput: CreateAiSuggestionInput = {
        target_table: 'tech_keyword',
        workflow: 'keyword_mapping',
        action: 'insert',
        target_key: { tech: candidateKeyword, keyword: candidateKeyword },
        payload: { tech: candidateKeyword, keyword: candidateKeyword },
        evidence: {
          reasoning: `${baseReasoning}（選項一：建立對應映射）`,
          affectedCount,
          correlationId,
        } as unknown as Record<string, unknown>,
      };
      await this.createAndAggregate(
        newMappingInput,
        `tech_keyword mapping "${candidateKeyword}" -> "${candidateKeyword}"`,
        result,
      );
    } else {
      result.errors.push({
        message: `LLM returned matchedTechId: null without a suggestedCategory for keyword "${candidateKeyword}"`,
      });
    }

    const keywordBinInput: CreateAiSuggestionInput = {
      target_table: 'keyword_bin',
      workflow: 'keyword_mapping',
      action: 'insert',
      target_key: { id: candidateKeyword },
      payload: { id: candidateKeyword },
      evidence: {
        reasoning: `${baseReasoning}（選項二：排除此關鍵字，往後不再視為候選）`,
        affectedCount,
      } as unknown as Record<string, unknown>,
    };
    await this.createAndAggregate(
      keywordBinInput,
      `keyword_bin "${candidateKeyword}"`,
      result,
    );
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
          message: `Failed to create suggestion for ${identifierForErrorMessage}: ${createResult.error.message}`,
        });
        break;
    }
  }

  /**
   * Requirement 2.3's "受影響的職缺筆數估計": counts `job_keyword` rows
   * whose `keywords` text[] column contains `keyword`, using PostgREST's
   * `cs` ("contains") operator against a Postgres array literal (see
   * `libs/data-utils/src/lib/shared-services/supabase/utils.ts`'s generic
   * `where: { column: { operator: value } }` -> `.filter(column, operator,
   * value)` handling, which passes arbitrary operator strings straight
   * through).
   */
  private async countAffectedJobs(keyword: string): Promise<number> {
    const { count } = await this.jobKeywordService.fetchAll({
      where: { keywords: { cs: toPgArrayContainsLiteral(keyword) } },
    });
    return count;
  }
}

function buildUserPrompt(
  candidateKeyword: string,
  techEntries: readonly TechClassificationContext[],
): string {
  const techList = techEntries
    .map(tech => `- id: "${tech.id}", label: "${tech.label}", category: "${tech.category}"`)
    .join('\n');
  return [
    `Candidate keyword (extracted from job descriptions): "${candidateKeyword}"`,
    '',
    'Existing technology dictionary entries:',
    techList || '(none)',
    '',
    'Which entry, if any, does the candidate keyword map to?',
  ].join('\n');
}

/**
 * Formats a single value as a one-element Postgres array literal (e.g.
 * `{"node.js"}`), quoting and escaping it so keywords containing commas,
 * braces, quotes, or backslashes still produce a valid literal for
 * PostgREST's `cs` operator.
 */
function toPgArrayContainsLiteral(value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `{"${escaped}"}`;
}
