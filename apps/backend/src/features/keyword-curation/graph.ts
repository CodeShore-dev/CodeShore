import { Annotation } from '@langchain/langgraph';
import { Injectable } from '@nestjs/common';

import type { JobKeywordService, TechService } from '@codeshore/data-utils';

import type {
  AiRecommendation,
  CommitResult,
  CurationState,
  HumanDecision,
  TechOption,
} from './graph.types';

/**
 * design.md's `KeywordCurationGraph`（LangGraph）section, `CurationAnnotation`
 * state shape (~design.md lines 337-351). Field types and names must match
 * `graph.types.ts`'s `CurationState` verbatim -- `type CurationState = typeof
 * CurationAnnotation.State` per design.md, so this is the LangGraph-facing
 * mirror of that hand-written interface (kept as two separate declarations
 * here since `graph.types.ts` is a plain-TS contracts file with no
 * `@langchain/langgraph` dependency, per task 1.1's boundary).
 */
export const CurationAnnotation = Annotation.Root({
  keyword: Annotation<string>,
  affectedJobCount: Annotation<number>,
  allTechs: Annotation<ReadonlyArray<TechOption>>,
  aiRecommendation: Annotation<AiRecommendation | null>,
  humanDecision: Annotation<HumanDecision | null>,
  commitResult: Annotation<CommitResult | null>,
});

/**
 * Node 1 (`fetchContext`), design.md's `KeywordCurationGraph` section:
 * "載入所有 tech 條目 + 此 keyword 的受影響職缺數 / 輸出：allTechs,
 * affectedJobCount" (requirements 2.1, 2.2).
 *
 * Constructor-injected like `CurationLlmClassifier` (task 2.1) so task 3.6
 * can register this as a normal NestJS provider and inject it into whatever
 * assembles the `StateGraph` -- `this.node` is a bound arrow-function class
 * property (not a prototype method) specifically so it can be passed
 * directly as `.addNode('fetchContext', fetchContextNode.node)` without
 * losing its `this` binding, mirroring design.md's
 * `.addNode('fetchContext', fetchContextNode)` call shape.
 *
 * Only `TechService` and `JobKeywordService` are injected. The task text
 * also names `KeywordService` ("呼叫 KeywordService 取出 keyword 出現次數"),
 * but `CurationState` (graph.types.ts) has no field for a keyword's raw
 * occurrence count -- design.md's Node 1 pseudocode explicitly documents
 * this node's output as only `allTechs, affectedJobCount`, and the
 * occurrence count (`QueuedKeyword.count`) is already known before a
 * session even starts, surfaced by `getQueue()` (task 4.1) from
 * `KeywordService` there. See this task's status report CONCERNS for the
 * full reasoning.
 */
@Injectable()
export class FetchContextNode {
  constructor(
    private readonly techService: Pick<TechService, 'fetchAll'>,
    private readonly jobKeywordService: Pick<JobKeywordService, 'fetchAll'>,
  ) {}

  node = async (state: CurationState): Promise<Partial<CurationState>> => {
    const [{ result: techRows }, affectedJobCount] = await Promise.all([
      this.techService.fetchAll(),
      this.countAffectedJobs(state.keyword),
    ]);

    const allTechs: TechOption[] = techRows.map(tech => ({
      id: tech.id,
      label: tech.label,
      category: tech.category,
    }));

    return { allTechs, affectedJobCount };
  };

  /**
   * Same `cs` (Postgres array-contains) operator pattern as
   * `KeywordMappingGenerator.countAffectedJobs`
   * (apps/backend/src/features/ai-suggestion/generators/keyword-mapping.generator.ts) --
   * duplicated locally rather than imported since that method is private to
   * its class and there is no shared `data-utils` helper for it (checked:
   * `libs/data-utils` exposes no such export).
   */
  private async countAffectedJobs(keyword: string): Promise<number> {
    const { count } = await this.jobKeywordService.fetchAll({
      where: { keywords: { cs: toPgArrayContainsLiteral(keyword) } },
    });
    return count;
  }
}

function toPgArrayContainsLiteral(value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `{"${escaped}"}`;
}
