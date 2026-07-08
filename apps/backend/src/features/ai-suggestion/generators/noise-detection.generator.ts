import { createHash } from 'node:crypto';

import type { CreateAiSuggestionInput, JobService, KeywordService } from '@codeshore/data-utils';

import type { AiSuggestionEvidence } from '../service';
import type { LlmClient } from '../llm-client';

import {
  emptyGeneratorResult,
  GeneratorResult,
  SuggestionCreator,
  SuggestionGenerator,
} from './types';

/**
 * Upper bound on how many recent `job.description` rows are pulled for the
 * description-pattern noise sub-flow (requirement 6.2). Bounds a single
 * generator run to a reasonable, recent sample rather than scanning the
 * entire `job` table -- mirrors `LocationMappingGenerator.MAX_ANOMALY_JOBS`'s
 * rationale of a generous-but-bounded candidate pool. Exported so it is
 * easy to tune independently of the other generators' copies.
 */
export const JOB_DESCRIPTION_SAMPLE_SIZE = 200;

const KEYWORD_NOISE_TOOL_NAME = 'flag_noise_keywords';

const KEYWORD_NOISE_INPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    flaggedKeywords: {
      type: 'array',
      description:
        'Candidate keywords that are clearly NOT technology/skill terms and should be excluded from future keyword statistics (e.g. generic filler words, agency-boilerplate fragments, mis-tokenized junk). Only include keywords you are confident are noise -- omit any keyword you are unsure about, and return an empty array if none are noise.',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The exact id (text) of a candidate keyword that is noise.',
          },
          reasoning: {
            type: 'string',
            description:
              'Why this keyword is noise, including a brief illustrative example of the context it appears in (e.g. "appears in job descriptions as generic recruiter language, not a technology").',
          },
        },
        required: ['id', 'reasoning'],
      },
    },
  },
  required: ['flaggedKeywords'],
};

/** A single `keyword` row as sent to the LLM for noise-classification context. */
interface KeywordNoiseCandidate {
  id: string;
  count: number;
}

interface KeywordNoiseProposal {
  id: string;
  reasoning: string;
}

interface KeywordNoiseLlmResult extends Record<string, unknown> {
  flaggedKeywords?: KeywordNoiseProposal[];
}

const KEYWORD_NOISE_SYSTEM_PROMPT = `You maintain the quality of a keyword-frequency statistic derived from job postings.

You are given a list of candidate keywords, each with its current occurrence count across job postings. Flag any keyword that is clearly NOT a technology or skill term -- for example generic filler words, agency/recruiter boilerplate fragments, or mis-tokenized junk that leaked into keyword extraction.

Do not flag a keyword just because it is unfamiliar or niche -- only flag it if it is clearly not a technology/skill term at all. For each flagged keyword, include a brief illustrative example of the kind of context it appears in as part of your reasoning.`;

const DESCRIPTION_PATTERN_TOOL_NAME = 'flag_noise_description_patterns';

const DESCRIPTION_PATTERN_INPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    flaggedPatterns: {
      type: 'array',
      description:
        'Repeated boilerplate substrings/patterns that appear across multiple of the provided job descriptions and would interfere with keyword extraction (e.g. contact-info blocks, recruiter-agency disclaimers, formatting artifacts). Return an empty array if no such repeated pattern is found.',
      items: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description:
              'The exact repeated substring/pattern text, copied verbatim from the descriptions it was found in (so it can be matched back against them).',
          },
          reasoning: {
            type: 'string',
            description: 'Why this substring is boilerplate noise that would interfere with keyword extraction.',
          },
        },
        required: ['pattern', 'reasoning'],
      },
    },
  },
  required: ['flaggedPatterns'],
};

interface DescriptionPatternProposal {
  pattern: string;
  reasoning: string;
}

interface DescriptionPatternLlmResult extends Record<string, unknown> {
  flaggedPatterns?: DescriptionPatternProposal[];
}

const DESCRIPTION_PATTERN_SYSTEM_PROMPT = `You maintain the quality of keyword extraction from job posting descriptions.

You are given a batch of raw job description texts. Identify repeated boilerplate substrings or patterns that appear across multiple of the provided descriptions and would interfere with keyword extraction -- for example contact-info blocks, recruiter-agency disclaimers, or formatting artifacts.

For each pattern you flag, return the exact substring text (verbatim, so it can be matched back against the original descriptions) plus a short reasoning explaining why it is boilerplate noise. Only flag patterns you actually observed repeated across more than one description; return an empty array if none are found.`;

/**
 * Requirement 6 (`noise_detection` workflow): two independent sub-flows
 * feeding the same `GeneratorResult`.
 *
 * 1. Keyword-bin noise detection (6.1, 6.3): every `keyword` row (mapped or
 *    not -- unlike `KeywordMappingGenerator`, this sub-flow's question is
 *    "is this even a real term at all", not "does it map to a tech", so it
 *    does not filter against `tech_keyword`) is sent to the LLM in a single
 *    batched call asking which are clearly not technology/skill terms. Each
 *    flagged keyword becomes a `keyword_bin` suggestion whose
 *    `evidence.affectedCount` is that keyword's own `count` and whose
 *    `evidence.reasoning` is the LLM's explanation (asked, via the prompt,
 *    to itself read as illustrating why the keyword is noise).
 * 2. Job-description noise-pattern detection (6.2, 6.3): a bounded, recent
 *    sample of `job.description` rows (`JOB_DESCRIPTION_SAMPLE_SIZE`) is
 *    sent to the LLM in a single batched call asking for repeated
 *    boilerplate substrings. Each flagged pattern becomes a
 *    `job_description_bin` suggestion whose `evidence.affectedCount` is a
 *    client-side count of how many sampled descriptions actually contain
 *    that exact substring, and whose `target_key.content_hash` is a SHA-256
 *    hex digest of the pattern text (design.md: `job_description_bin`'s
 *    real primary key is a generated `uuid`, not the content itself, so the
 *    content hash stands in as the natural dedupe key).
 *
 * The two sub-flows run sequentially but are failure-isolated from each
 * other: unlike the other 4 generators (one LLM call per run, so a failure
 * aborts the whole batch), this generator makes two separate LLM calls for
 * two independent purposes, so a failure in one sub-flow only records an
 * error for that sub-flow and the other sub-flow still runs to completion.
 */
export class NoiseDetectionGenerator implements SuggestionGenerator {
  readonly workflow = 'noise_detection' as const;

  constructor(
    private readonly llmClient: LlmClient,
    private readonly keywordService: KeywordService,
    private readonly jobService: JobService,
    private readonly suggestionCreator: SuggestionCreator,
  ) {}

  async generate(): Promise<GeneratorResult> {
    const result = emptyGeneratorResult();

    await this.runKeywordNoiseSubflow(result);
    await this.runDescriptionPatternSubflow(result);

    return result;
  }

  private async runKeywordNoiseSubflow(result: GeneratorResult): Promise<void> {
    const { result: keywords } = await this.keywordService.fetchAll();
    if (keywords.length === 0) {
      return;
    }

    const countById = new Map<string, number>(keywords.map(keyword => [keyword.id, keyword.count]));
    const candidates: KeywordNoiseCandidate[] = keywords.map(keyword => ({
      id: keyword.id,
      count: keyword.count,
    }));

    const completion = await this.llmClient.completeStructured<KeywordNoiseLlmResult>({
      systemPrompt: KEYWORD_NOISE_SYSTEM_PROMPT,
      userPrompt: buildKeywordNoiseUserPrompt(candidates),
      toolName: KEYWORD_NOISE_TOOL_NAME,
      inputSchema: KEYWORD_NOISE_INPUT_SCHEMA,
      input: { candidates },
    });

    if (!completion.ok) {
      // Isolated from the description-pattern sub-flow: this failure is
      // recorded and this sub-flow stops here, but `generate()` still goes
      // on to run `runDescriptionPatternSubflow`.
      result.errors.push({
        message: `LLM keyword-noise detection failed: ${completion.error}`,
      });
      return;
    }

    const { flaggedKeywords = [] } = completion.result;

    for (const proposal of flaggedKeywords) {
      const affectedCount = countById.get(proposal.id) ?? 0;

      const evidence: AiSuggestionEvidence = {
        affectedCount,
        reasoning: proposal.reasoning,
      };

      const createInput: CreateAiSuggestionInput = {
        target_table: 'keyword_bin',
        workflow: 'noise_detection',
        action: 'insert',
        target_key: { id: proposal.id },
        payload: { id: proposal.id },
        evidence: evidence as unknown as Record<string, unknown>,
      };

      await this.createAndAggregate(createInput, `keyword "${proposal.id}"`, result);
    }
  }

  private async runDescriptionPatternSubflow(result: GeneratorResult): Promise<void> {
    const { result: jobs } = await this.jobService.fetchAll({
      orders: [{ column: 'created_at', ascending: false }],
      select: 'description',
    });
    const descriptions = jobs.slice(0, JOB_DESCRIPTION_SAMPLE_SIZE).map(job => job.description);

    if (descriptions.length === 0) {
      return;
    }

    const completion = await this.llmClient.completeStructured<DescriptionPatternLlmResult>({
      systemPrompt: DESCRIPTION_PATTERN_SYSTEM_PROMPT,
      userPrompt: buildDescriptionPatternUserPrompt(descriptions),
      toolName: DESCRIPTION_PATTERN_TOOL_NAME,
      inputSchema: DESCRIPTION_PATTERN_INPUT_SCHEMA,
      input: { descriptions },
    });

    if (!completion.ok) {
      // Isolated from the keyword-noise sub-flow: whether or not that
      // sub-flow already ran (and regardless of its outcome), this failure
      // only affects this sub-flow's own contribution to `result`.
      result.errors.push({
        message: `LLM description-noise-pattern detection failed: ${completion.error}`,
      });
      return;
    }

    const { flaggedPatterns = [] } = completion.result;

    for (const proposal of flaggedPatterns) {
      // Requirement 6.3's "出現筆數": a simple client-side count over the
      // sample already held in memory, not a full-table scan or a separate
      // query.
      const affectedCount = descriptions.filter(description => description.includes(proposal.pattern)).length;
      const contentHash = createHash('sha256').update(proposal.pattern).digest('hex');

      const evidence: AiSuggestionEvidence = {
        affectedCount,
        reasoning: `${proposal.reasoning} (example: found in ${affectedCount} of ${descriptions.length} sampled job descriptions)`,
      };

      const createInput: CreateAiSuggestionInput = {
        target_table: 'job_description_bin',
        workflow: 'noise_detection',
        action: 'insert',
        target_key: { content_hash: contentHash },
        payload: { content: proposal.pattern },
        evidence: evidence as unknown as Record<string, unknown>,
      };

      await this.createAndAggregate(createInput, `description pattern "${proposal.pattern}"`, result);
    }
  }

  private async createAndAggregate(
    createInput: CreateAiSuggestionInput,
    identifierForErrorMessage: string,
    result: GeneratorResult,
  ): Promise<void> {
    const createResult = await this.suggestionCreator.createSuggestion(createInput);

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
}

function buildKeywordNoiseUserPrompt(candidates: readonly KeywordNoiseCandidate[]): string {
  const candidateList = candidates.map(candidate => `- id: "${candidate.id}", count: ${candidate.count}`).join('\n');
  return [
    'Candidate keywords (extracted from job descriptions), with their current occurrence count:',
    candidateList || '(none)',
    '',
    'Which of these, if any, are clearly not technology/skill terms and should be flagged as noise?',
  ].join('\n');
}

function buildDescriptionPatternUserPrompt(descriptions: readonly string[]): string {
  const descriptionList = descriptions
    .map((description, index) => `[${index + 1}] ${description}`)
    .join('\n\n');
  return [
    `Sample of ${descriptions.length} recent job description texts:`,
    descriptionList || '(none)',
    '',
    'Identify any repeated boilerplate substrings/patterns across multiple of these descriptions that would interfere with keyword extraction.',
  ].join('\n');
}
