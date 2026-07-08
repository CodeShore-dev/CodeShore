import type { CreateAiSuggestionInput, LocationGroupService } from '@codeshore/data-utils';
import { fetchLocationAnomalyJobs } from '@codeshore/data-utils';

import type { AiSuggestionEvidence } from '../service';
import type { LlmClient } from '../llm-client';

import {
  emptyGeneratorResult,
  GeneratorResult,
  SuggestionCreator,
  SuggestionGenerator,
} from './types';
import { isStandardLocationGroupFormat } from '../validation/location-format-check';

/**
 * Confidence score (0..1, from the LLM's `confidence`) below which a
 * matched-existing-group mapping suggestion is flagged
 * `evidence.needsVerification = true` rather than being treated as a
 * high-confidence, fast-to-review suggestion. Mirrors
 * `KeywordMappingGenerator.LOW_CONFIDENCE_THRESHOLD`: requirement 8.1
 * classifies `location_group_location` (alongside `tech_keyword`) as a
 * "映射類" (mapping-type) suggestion that must carry a confidence score, and
 * flag low-confidence matches for extra human scrutiny. Exported so it is
 * easy to tune independently of the other generators' copies.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Upper bound on how many anomalous ("unmapped location") job rows are
 * pulled from `fetchLocationAnomalyJobs` in one run. Generous enough to
 * cover realistic backlogs of distinct unmapped location strings while still
 * bounding a single generator run.
 */
export const MAX_ANOMALY_JOBS = 200;

export const TOOL_NAME = 'propose_location_mappings';

export const INPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    proposals: {
      type: 'array',
      description:
        'Exactly one proposal per distinct unmapped location string provided. For each, either matchedGroupId (the location string clearly belongs to an existing location_group) or proposedNewGroupId (no existing group fits, propose creating a new one) must be set -- never both, never neither.',
      items: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description:
              'The exact unmapped location string this proposal is about.',
          },
          matchedGroupId: {
            type: ['string', 'null'],
            description:
              'The "id" of the existing location_group this location string should join, or null if no existing group fits.',
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description:
              'Confidence (0..1) that matchedGroupId is correct. Required whenever matchedGroupId is not null.',
          },
          proposedNewGroupId: {
            type: ['string', 'null'],
            description:
              'A proposed id for a brand-new location_group, set only when matchedGroupId is null. Must follow Taiwan\'s official administrative naming convention: <縣市><鄉鎮市區> concatenated with no separator, using full official Chinese names (e.g. "台北市信義區", "新竹縣竹北市"). Never an English slug or abbreviation.',
          },
          reasoning: {
            type: 'string',
            description:
              'One or two sentences explaining the decision (why this group matches, or why none fit and a new group is proposed).',
          },
        },
        required: ['location', 'matchedGroupId', 'proposedNewGroupId', 'reasoning'],
      },
    },
  },
  required: ['proposals'],
};

/** An existing `location_group` entry as sent to the LLM for matching context. */
interface LocationGroupContext {
  id: string;
}

interface LocationMappingProposal {
  location: string;
  matchedGroupId: string | null;
  confidence?: number;
  proposedNewGroupId: string | null;
  reasoning: string;
}

interface LocationMappingLlmResult extends Record<string, unknown> {
  proposals?: LocationMappingProposal[];
}

export const SYSTEM_PROMPT = `You maintain a normalization mapping from raw, free-text job-posting location strings (e.g. "台北市信義區", "新竹科學園區") to a small set of standardized location groups.

Every location group id MUST follow Taiwan's official administrative naming convention: <縣市名稱><鄉鎮市區名稱> concatenated with no separator or spaces, using full official Chinese names -- e.g. "台北市信義區", "新竹縣竹北市", "高雄市苓雅區". Never use an English slug, abbreviation, or a partial name (e.g. "taipei" and "信義區" alone are both invalid).

You are given (1) a list of distinct raw location strings that do not currently map to any existing location group, and (2) the full list of existing location group ids.

For every listed location string, decide exactly one of the following:
- It clearly belongs to one of the existing location groups: return that group's "id" as matchedGroupId, along with a confidence score between 0 and 1.
- No existing group fits: return matchedGroupId: null and propose a new group id as proposedNewGroupId, following the "<縣市><鄉鎮市區>" naming convention above (e.g. "新竹縣竹北市"). If the raw location string spans a larger or more general area than a single 鄉鎮市區 (e.g. "新竹科學園區", which sits across Hsinchu City and Hsinchu County), pick the single 縣市+鄉鎮市區 it most representatively belongs to. Do not force a match to an unrelated existing group just to avoid creating a new one.

Always include a short "reasoning" for each proposal, and return exactly one proposal per listed location string.`;

/**
 * Requirement 5 (`location_mapping` workflow): consumes the existing,
 * read-only `fetchLocationAnomalyJobs('unmapped', ...)` anomaly detection
 * (never reimplemented here) to find job postings whose `location` string
 * does not map to any `location_group` (5.1), groups them by distinct
 * location string to compute each string's affected job count (5.3), and
 * asks the LLM in a single batched call (mirroring `TechHierarchyGenerator`/
 * `TechDictionaryGenerator`) to either match each string to an existing
 * `location_group` or propose creating a new one (5.2).
 *
 * A matched-existing-group proposal creates one `location_group_location`
 * suggestion. A no-match proposal creates *two* linked suggestions -- a new
 * `location_group` and its paired `location_group_location` mapping --
 * sharing a freshly generated `evidence.correlationId` so a reviewer (and
 * `approve()`) can tell they belong together (design.md's `location_mapping`
 * `target_key` examples). The two suggestions in a pair are created and
 * counted independently: one succeeding and the other being a duplicate (or
 * erroring) does not affect the other's outcome.
 */
export class LocationMappingGenerator implements SuggestionGenerator {
  readonly workflow = 'location_mapping' as const;

  constructor(
    private readonly llmClient: LlmClient,
    private readonly locationGroupService: LocationGroupService,
    private readonly suggestionCreator: SuggestionCreator,
  ) {}

  async generate(): Promise<GeneratorResult> {
    const result = emptyGeneratorResult();

    // `fetchLocationAnomalyJobs` is called directly (not constructor
    // injected) since it is a plain function import from
    // `@codeshore/data-utils`, mirroring `TechHierarchyGenerator`'s direct
    // (not-injected) use of `detectTechParentCycle` -- tests mock the module
    // itself (like `service.spec.ts` does for `refreshAllMaterializedViews`)
    // rather than faking this through the constructor.
    const { result: anomalyJobs } = await fetchLocationAnomalyJobs(
      'unmapped',
      MAX_ANOMALY_JOBS,
      { from: 0, to: -1, where: {}, orders: [] },
    );

    const affectedCountByLocation = new Map<string, number>();
    for (const job of anomalyJobs) {
      const location = job.location;
      affectedCountByLocation.set(
        location,
        (affectedCountByLocation.get(location) ?? 0) + 1,
      );
    }

    const distinctLocations = Array.from(affectedCountByLocation.keys());
    if (distinctLocations.length === 0) {
      return result;
    }

    const { result: locationGroupRows } =
      await this.locationGroupService.fetchAll();
    const existingGroups: LocationGroupContext[] = locationGroupRows.map(
      group => ({ id: group.id }),
    );

    const completion =
      await this.llmClient.completeStructured<LocationMappingLlmResult>({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: buildUserPrompt(distinctLocations, existingGroups),
        toolName: TOOL_NAME,
        inputSchema: INPUT_SCHEMA,
        input: { distinctLocations, existingGroups },
      });

    if (!completion.ok) {
      // Like `TechHierarchyGenerator`/`TechDictionaryGenerator` (one LLM
      // call for the whole batch), a single failure here means the entire
      // run produces nothing.
      result.errors.push({
        message: `LLM location-mapping proposal failed: ${completion.error}`,
      });
      return result;
    }

    const { proposals = [] } = completion.result;

    for (const proposal of proposals) {
      const affectedCount = affectedCountByLocation.get(proposal.location) ?? 0;
      await this.processProposal(proposal, affectedCount, result);
    }

    return result;
  }

  private async processProposal(
    proposal: LocationMappingProposal,
    affectedCount: number,
    result: GeneratorResult,
  ): Promise<void> {
    const { location, matchedGroupId, proposedNewGroupId, reasoning } =
      proposal;

    if (matchedGroupId) {
      await this.createMappingSuggestion(
        matchedGroupId,
        location,
        affectedCount,
        reasoning,
        proposal.confidence,
        undefined,
        result,
      );
      return;
    }

    if (proposedNewGroupId) {
      // Requirement 5.2: a paired new-group + new-mapping suggestion,
      // linked via a freshly generated `correlationId` (design.md's
      // `location_mapping` `target_key` examples: `{"id": "taipei"}` for
      // the group, `{"location_group": "taipei", "location": "..."}` for
      // the mapping). Each half is created and counted independently.
      const correlationId = crypto.randomUUID();

      // Requirement: 統一 location_group 格式為「縣市+鄉鎮市區」（如
      // "台北市信義區"）。The LLM is instructed to always follow this
      // convention (SYSTEM_PROMPT/INPUT_SCHEMA above), but its output is
      // never trusted blindly -- a non-conforming id is still created (so a
      // reviewer can fix it via the existing "修改後核准" edit-before-approve
      // flow) but flagged `needsVerification` so it doesn't slip through as
      // a routine, low-scrutiny suggestion.
      const formatOk = isStandardLocationGroupFormat(proposedNewGroupId);

      const createGroupInput: CreateAiSuggestionInput = {
        target_table: 'location_group',
        workflow: 'location_mapping',
        action: 'insert',
        target_key: { id: proposedNewGroupId },
        payload: { id: proposedNewGroupId },
        evidence: {
          affectedCount,
          reasoning: formatOk
            ? reasoning
            : `${reasoning}（群組 ID 不符合「縣市+鄉鎮市區」標準格式，請人工確認或修正）`,
          needsVerification: !formatOk,
          correlationId,
        } as unknown as Record<string, unknown>,
      };
      await this.createAndAggregate(
        createGroupInput,
        `location_group "${proposedNewGroupId}"`,
        result,
      );

      await this.createMappingSuggestion(
        proposedNewGroupId,
        location,
        affectedCount,
        reasoning,
        undefined,
        correlationId,
        result,
      );
      return;
    }

    // The LLM violated the "exactly one of matchedGroupId/proposedNewGroupId"
    // contract stated in the system prompt and `inputSchema`. This is not
    // the same thing as a legitimate "no suitable match" outcome (which this
    // workflow always resolves into a new-group proposal, per requirement
    // 5.2), so it is recorded as an error rather than silently skipped or
    // counted via `skippedNoMatch` (which does not apply to this
    // generator's normal flow).
    result.errors.push({
      message: `LLM returned neither matchedGroupId nor proposedNewGroupId for location "${location}"`,
    });
  }

  private async createMappingSuggestion(
    locationGroupId: string,
    location: string,
    affectedCount: number,
    reasoning: string,
    confidence: number | undefined,
    correlationId: string | undefined,
    result: GeneratorResult,
  ): Promise<void> {
    const needsVerification =
      typeof confidence === 'number' && confidence < LOW_CONFIDENCE_THRESHOLD;

    const evidence: AiSuggestionEvidence = {
      affectedCount,
      reasoning,
      ...(confidence !== undefined ? { confidence, needsVerification } : {}),
      ...(correlationId !== undefined ? { correlationId } : {}),
    };

    const createInput: CreateAiSuggestionInput = {
      target_table: 'location_group_location',
      workflow: 'location_mapping',
      action: 'insert',
      target_key: { location_group: locationGroupId, location },
      payload: { location_group: locationGroupId, location },
      evidence: evidence as unknown as Record<string, unknown>,
    };

    await this.createAndAggregate(
      createInput,
      `location "${location}" -> group "${locationGroupId}"`,
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
}

function buildUserPrompt(
  distinctLocations: readonly string[],
  existingGroups: readonly LocationGroupContext[],
): string {
  const locationList = distinctLocations.map(location => `- "${location}"`).join('\n');
  const groupList = existingGroups.map(group => `- id: "${group.id}"`).join('\n');
  return [
    'Distinct raw job-posting location strings that do not currently map to any location group:',
    locationList || '(none)',
    '',
    'Existing location groups:',
    groupList || '(none)',
    '',
    'For each listed location string, either match it to an existing group or propose a new one.',
  ].join('\n');
}
