import { Module as ModuleDecorator, Provider } from '@nestjs/common';

import {
  AiLlmSettingService,
  JobKeywordService,
  KeywordBinService,
  KeywordService,
  TechKeywordService,
  TechParentService,
  TechService,
} from '@codeshore/data-utils';

import { provideWithLogger } from '../logger-provider';
import { Controller } from './controller';
import { DynamicLlmClient } from './dynamic-llm-client';
import {
  ClassifyNode,
  CommitKeywordBinNode,
  CommitMappingNode,
  FetchContextNode,
  KeywordCurationGraph,
  ValidateAndCommitNewTechNode,
} from './graph';
import { CurationLlmClassifier } from './llm-classifier';
import { Service } from './service';

/**
 * Requirement 2.1 / design.md's file structure plan. Task 4.2 adds the
 * `KeywordCurationGraph` singleton and its full dependency chain
 * (`CurationLlmClassifier` -> `DynamicLlmClient` -> `AiLlmSettingService`,
 * the 5 graph nodes, and the extra data-utils services (`TechService`,
 * `TechParentService`) those nodes need beyond the 4 already registered by
 * task 4.1).
 *
 * Every one of these is registered as an explicit `useFactory`/`inject`
 * provider rather than a bare class (`provide: X, useClass: X` /
 * shorthand `X`) -- this is NOT a stylistic choice. `FetchContextNode`,
 * `ClassifyNode`, `CommitMappingNode`, `ValidateAndCommitNewTechNode`,
 * `CommitKeywordBinNode`, `CurationLlmClassifier`, `DynamicLlmClient`, and
 * `Service` itself all declare their constructor parameters as narrowed
 * `Pick<SomeClass, 'method'>` interface types (or, for `CurationLlmClassifier`,
 * the bare `LlmClient` interface type) rather than the concrete class type.
 * Verified directly against this repo's actual `tsc --emitDecoratorMetadata`
 * output (the same compiler settings `tsconfig.app.json` uses for the real
 * `build-lambda` target): TypeScript can only capture a class reference in
 * `design:paramtypes` for a parameter typed as that exact class (or
 * interface backed by one); a `Pick<X, K>` mapped type or a plain interface
 * erases to `Object`. If these providers were registered as bare classes,
 * Nest's automatic constructor-injection-by-type would try to resolve each
 * such parameter against a provider registered under the token `Object`,
 * which does not exist, and the module would throw
 * `UnknownDependenciesException` at boot in a real build (this repo's
 * Vitest/esbuild pipeline masks the bug instead of catching it: it never
 * emits `design:paramtypes` metadata at all, so Nest falls back to treating
 * the class as having zero constructor dependencies and silently
 * constructs it with every parameter `undefined` -- see this task's status
 * report CONCERNS). `useFactory`/`inject` sidesteps automatic type-based
 * resolution entirely by naming each dependency's provider token
 * explicitly, which is exactly why `provideWithLogger` (below, already used
 * for every data-utils provider in this module) does the same thing for
 * `ServiceLogger`.
 */
const dynamicLlmClientProvider: Provider = {
  provide: DynamicLlmClient,
  useFactory: (llmSettingService: AiLlmSettingService) => new DynamicLlmClient(llmSettingService),
  inject: [AiLlmSettingService],
};

const curationLlmClassifierProvider: Provider = {
  provide: CurationLlmClassifier,
  useFactory: (llmClient: DynamicLlmClient) => new CurationLlmClassifier(llmClient),
  inject: [DynamicLlmClient],
};

const fetchContextNodeProvider: Provider = {
  provide: FetchContextNode,
  useFactory: (techService: TechService, jobKeywordService: JobKeywordService) =>
    new FetchContextNode(techService, jobKeywordService),
  inject: [TechService, JobKeywordService],
};

const classifyNodeProvider: Provider = {
  provide: ClassifyNode,
  useFactory: (curationLlmClassifier: CurationLlmClassifier) => new ClassifyNode(curationLlmClassifier),
  inject: [CurationLlmClassifier],
};

const commitMappingNodeProvider: Provider = {
  provide: CommitMappingNode,
  useFactory: (techKeywordService: TechKeywordService) => new CommitMappingNode(techKeywordService),
  inject: [TechKeywordService],
};

const validateAndCommitNewTechNodeProvider: Provider = {
  provide: ValidateAndCommitNewTechNode,
  useFactory: (
    techService: TechService,
    techKeywordService: TechKeywordService,
    techParentService: TechParentService,
  ) => new ValidateAndCommitNewTechNode(techService, techKeywordService, techParentService),
  inject: [TechService, TechKeywordService, TechParentService],
};

const commitKeywordBinNodeProvider: Provider = {
  provide: CommitKeywordBinNode,
  useFactory: (keywordBinService: KeywordBinService) => new CommitKeywordBinNode(keywordBinService),
  inject: [KeywordBinService],
};

/**
 * The `KeywordCurationGraph` singleton -- see task 4.2's architectural
 * constraint: exactly one compiled `app`/`MemorySaver` must be shared across
 * every HTTP request for `startSession`'s interrupt and a later
 * `resumeSession` call (same `thread_id`) to correctly resume the same
 * paused checkpoint. Nest's default provider scope is already singleton, so
 * simply registering this once via `useFactory` (constructed once, reused
 * for every injection) is sufficient -- no explicit `Scope.DEFAULT`
 * annotation needed.
 */
const keywordCurationGraphProvider: Provider = {
  provide: KeywordCurationGraph,
  useFactory: (
    fetchContextNode: FetchContextNode,
    classifyNode: ClassifyNode,
    commitMappingNode: CommitMappingNode,
    validateAndCommitNewTechNode: ValidateAndCommitNewTechNode,
    commitKeywordBinNode: CommitKeywordBinNode,
  ) =>
    new KeywordCurationGraph(
      fetchContextNode,
      classifyNode,
      commitMappingNode,
      validateAndCommitNewTechNode,
      commitKeywordBinNode,
    ),
  inject: [
    FetchContextNode,
    ClassifyNode,
    CommitMappingNode,
    ValidateAndCommitNewTechNode,
    CommitKeywordBinNode,
  ],
};

const serviceProvider: Provider = {
  provide: Service,
  useFactory: (
    keywordService: KeywordService,
    techKeywordService: TechKeywordService,
    keywordBinService: KeywordBinService,
    jobKeywordService: JobKeywordService,
    graph: KeywordCurationGraph,
  ) => new Service(keywordService, techKeywordService, keywordBinService, jobKeywordService, graph),
  inject: [KeywordService, TechKeywordService, KeywordBinService, JobKeywordService, KeywordCurationGraph],
};

@ModuleDecorator({
  imports: [],
  controllers: [Controller],
  providers: [
    serviceProvider,
    provideWithLogger(KeywordService),
    provideWithLogger(TechKeywordService),
    provideWithLogger(KeywordBinService),
    provideWithLogger(JobKeywordService),
    provideWithLogger(TechService),
    provideWithLogger(TechParentService),
    provideWithLogger(AiLlmSettingService),
    dynamicLlmClientProvider,
    curationLlmClassifierProvider,
    fetchContextNodeProvider,
    classifyNodeProvider,
    commitMappingNodeProvider,
    validateAndCommitNewTechNodeProvider,
    commitKeywordBinNodeProvider,
    keywordCurationGraphProvider,
  ],
})
export class Module {}
