import type { LlmClient } from '@codeshore/ai-client';
import type {
  CreateAiSuggestionInput,
  TechParentService,
  TechService,
} from '@codeshore/data-utils';

import type { AiSuggestionEvidence } from '../service';
import { detectTechParentCycle } from '../validation/cycle-check';

import {
  emptyGeneratorResult,
  GeneratorProgress,
  GeneratorResult,
  SuggestionCreator,
  SuggestionGenerator,
} from './types';

export const TOOL_NAME = 'propose_tech_hierarchy_edges';

export const INPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    proposals: {
      type: 'array',
      description:
        'Zero or more proposed parent/child tech_parent edges, each involving at least one of the listed "isolated" candidate techs (techs not currently part of any existing edge). Return an empty array if none of the candidates have an obvious hierarchy relationship.',
      items: {
        type: 'object',
        properties: {
          parent: {
            type: 'string',
            description:
              'The "id" of the existing tech that should be the parent (broader/umbrella technology).',
          },
          child: {
            type: 'string',
            description:
              'The "id" of the existing tech that should be the child (more specific technology that belongs under parent).',
          },
          reasoning: {
            type: 'string',
            description:
              'One or two sentences explaining why parent is the broader technology child belongs under.',
          },
        },
        required: ['parent', 'child', 'reasoning'],
      },
    },
  },
  required: ['proposals'],
};

/** A single `tech` dictionary entry as sent to the LLM for hierarchy-proposal context. */
interface TechHierarchyContext {
  id: string;
  label: string;
  category: string;
}

/** A single existing `tech_parent` edge as sent to the LLM for hierarchy context. */
interface TechParentEdgeContext {
  parent: string;
  child: string;
}

interface TechHierarchyProposal {
  parent: string;
  child: string;
  reasoning: string;
}

interface TechHierarchyLlmResult extends Record<string, unknown> {
  proposals?: TechHierarchyProposal[];
}

export const SYSTEM_PROMPT = `You maintain a parent/child hierarchy over a standardized technology dictionary (e.g. "react" belongs under "javascript", "django" belongs under "python").

You are given (1) the full list of existing technology dictionary entries (each with an "id", human-readable "label", and "category"), (2) the full list of existing parent/child edges already in the hierarchy, and (3) a list of "isolated" candidate tech ids that do not currently appear as either a parent or a child in any existing edge.

Propose zero or more new parent/child edges. Every proposed edge must involve at least one of the listed isolated candidate tech ids (as either the parent or the child) -- do not propose edges that only connect two techs which are already part of the hierarchy. Only propose an edge when the from-subordinate relationship is clear and well known (e.g. a specific framework/library belonging under its base language or platform); do not force a relationship that is not obviously true. Always include a short "reasoning" for each proposal.`;

/**
 * Requirement 4 (`tech_hierarchy` workflow): finds `tech` entries not yet
 * part of any `tech_parent` edge ("尚未被納入任何階層", 4.1), asks the LLM
 * (in a single batched call, mirroring `TechDictionaryGenerator`) to propose
 * parent/child edges involving those isolated candidates, and creates a
 * `pending` `tech_parent` suggestion for each proposal that
 * `detectTechParentCycle` clears.
 *
 * A proposed edge that would form a cycle is never turned into a
 * suggestion at all -- not even a conflict-flagged one -- per requirement
 * 4.2's "拒絕產生該建議...且不得提交為可直接核准的 pending 建議": it is
 * counted in `skippedConflict` instead of `created` or `errors`, since a
 * detected cycle is the validation hook working correctly, not a failure
 * (8.2). This mirrors the rigor of task 2.2's `approve()` cycle-check gate,
 * just earlier in the pipeline (at generation time instead of approval
 * time).
 *
 * Each created suggestion's `evidence.reasoning` includes both the LLM's
 * own reasoning and a summary of the proposed parent's and child's existing
 * parent/child relationships (4.3), so the reviewer can judge the proposal
 * in the context of the hierarchy as it stands today.
 */
export class TechHierarchyGenerator implements SuggestionGenerator {
  readonly workflow = 'tech_hierarchy' as const;

  constructor(
    private readonly llmClient: LlmClient,
    private readonly techService: TechService,
    private readonly techParentService: TechParentService,
    private readonly suggestionCreator: SuggestionCreator,
  ) {}

  async *generate(): AsyncGenerator<GeneratorProgress, GeneratorResult> {
    const result = emptyGeneratorResult();

    const [{ result: techRows }, { result: edgeRows }] = await Promise.all([
      this.techService.fetchAll(),
      this.techParentService.fetchAll(),
    ]);

    const edges: TechParentEdgeContext[] = edgeRows.map(edge => ({
      parent: edge.parent,
      child: edge.child,
    }));

    const inHierarchy = new Set<string>();
    for (const edge of edges) {
      inHierarchy.add(edge.parent);
      inHierarchy.add(edge.child);
    }

    const isolatedCandidateIds = techRows
      .map(tech => tech.id)
      .filter(id => !inHierarchy.has(id));

    if (isolatedCandidateIds.length === 0) {
      return result;
    }

    const techEntries: TechHierarchyContext[] = techRows.map(tech => ({
      id: tech.id,
      label: tech.label,
      category: tech.category,
    }));

    const completion =
      await this.llmClient.completeStructured<TechHierarchyLlmResult>({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: buildUserPrompt(isolatedCandidateIds, techEntries, edges),
        toolName: TOOL_NAME,
        inputSchema: INPUT_SCHEMA,
        input: {
          isolatedCandidateIds,
          techEntries,
          edges,
        },
      });

    if (!completion.ok) {
      // Like `TechDictionaryGenerator` (one LLM call for the whole batch),
      // a single failure here means the entire run produces nothing.
      result.errors.push({
        message: `LLM tech-hierarchy proposal failed: ${completion.error}`,
      });
      return result;
    }

    const { proposals = [] } = completion.result;

    for (const [index, proposal] of proposals.entries()) {
      yield {
        message: `Processing hierarchy proposal ${index + 1}/${proposals.length}: "${proposal.parent}" -> "${proposal.child}"`,
      };
      await this.processProposal(proposal, edges, result);
    }

    return result;
  }

  private async processProposal(
    proposal: TechHierarchyProposal,
    edges: readonly TechParentEdgeContext[],
    result: GeneratorResult,
  ): Promise<void> {
    const { parent, child, reasoning } = proposal;

    let cycleResult: { hasCycle: boolean; conflictPath?: readonly string[] };
    try {
      cycleResult = await detectTechParentCycle(parent, child);
    } catch (error) {
      // The cycle check itself failing to run is not the same as it running
      // and finding no cycle -- treat it as a generation failure and, since
      // we cannot confirm the edge is safe, do not create a suggestion for
      // it (fail closed, same posture as `detectTechParentCycle` throwing
      // rather than swallowing an RPC error).
      result.errors.push({
        message: `Cycle check failed for proposed edge parent "${parent}" -> child "${child}": ${toErrorMessage(error)}`,
      });
      return;
    }

    if (cycleResult.hasCycle) {
      // Requirement 4.2/8.2: a detected cycle must never become a `pending`
      // suggestion, conflict-flagged or otherwise -- it is recorded purely
      // as a count, not as a created-but-blocked row.
      result.skippedConflict++;
      return;
    }

    const evidence: AiSuggestionEvidence = {
      reasoning: buildEvidenceReasoning(parent, child, reasoning, edges),
    };

    const createInput: CreateAiSuggestionInput = {
      target_table: 'tech_parent',
      workflow: 'tech_hierarchy',
      action: 'insert',
      target_key: { parent, child },
      payload: { parent, child },
      evidence: evidence as unknown as Record<string, unknown>,
    };

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
          message: `Failed to create suggestion for parent "${parent}" -> child "${child}": ${createResult.error.message}`,
        });
        break;
    }
  }
}

/**
 * Requirement 4.3: summarizes the proposed parent's and child's existing
 * parent/child relationships (drawn from the already-fetched `tech_parent`
 * edges, not just the isolated candidate's own relationships, which are
 * empty by definition) so a reviewer can judge the proposal against the
 * hierarchy as it stands today.
 */
function buildEvidenceReasoning(
  parent: string,
  child: string,
  llmReasoning: string,
  edges: readonly TechParentEdgeContext[],
): string {
  const describe = (techId: string): string => {
    const existingParents = edges
      .filter(edge => edge.child === techId)
      .map(edge => edge.parent);
    const existingChildren = edges
      .filter(edge => edge.parent === techId)
      .map(edge => edge.child);
    const parentsText =
      existingParents.length > 0 ? existingParents.join(', ') : '(none)';
    const childrenText =
      existingChildren.length > 0 ? existingChildren.join(', ') : '(none)';
    return `"${techId}" existing parents: ${parentsText}; existing children: ${childrenText}`;
  };

  return [
    llmReasoning,
    `Existing hierarchy context -- ${describe(parent)}. ${describe(child)}.`,
  ].join(' ');
}

function buildUserPrompt(
  isolatedCandidateIds: readonly string[],
  techEntries: readonly TechHierarchyContext[],
  edges: readonly TechParentEdgeContext[],
): string {
  const candidateList = isolatedCandidateIds
    .map(id => `- "${id}"`)
    .join('\n');
  const techList = techEntries
    .map(tech => `- id: "${tech.id}", label: "${tech.label}", category: "${tech.category}"`)
    .join('\n');
  const edgeList = edges
    .map(edge => `- parent: "${edge.parent}", child: "${edge.child}"`)
    .join('\n');
  return [
    'Isolated candidate tech ids (not currently part of any tech_parent edge, as either parent or child):',
    candidateList || '(none)',
    '',
    'Full existing technology dictionary entries:',
    techList || '(none)',
    '',
    'Existing tech_parent edges (parent -> child):',
    edgeList || '(none)',
    '',
    'Propose parent/child hierarchy edges, each involving at least one isolated candidate.',
  ].join('\n');
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
