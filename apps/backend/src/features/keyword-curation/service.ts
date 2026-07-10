import { Injectable } from '@nestjs/common';

import type {
  AiRecommendation,
  CommitResult,
  HumanDecision,
  QueuedKeyword,
} from './graph.types';

/**
 * design.md's `KeywordCurationServiceContract` — result of starting a
 * curation session: the LangGraph run to its first `interrupt()` (task
 * 3.1-3.6 wire the actual graph; this task only establishes the shape).
 */
export type StartSessionResult =
  | { ok: true; threadId: string; interrupt: AiRecommendation }
  | { ok: false; error: string };

/**
 * design.md's `KeywordCurationServiceContract` — result of resuming a
 * curation session with the admin's decision, running the graph to
 * completion.
 */
export type ResumeSessionResult =
  | { ok: true; result: CommitResult }
  | { ok: false; error: 'thread_not_found' | 'graph_error'; message: string };

/**
 * Requirement 2.1 / design.md's `KeywordCurationService` contract. This task
 * (1.2) only establishes the type-correct method skeleton against
 * `graph.types.ts` (task 1.1); the queue query (task 4.1), LangGraph session
 * start/resume wiring (task 4.2) and the graph itself (tasks 3.1-3.6) are
 * implemented in later tasks.
 */
@Injectable()
export class Service {
  async getQueue(): Promise<{ keywords: QueuedKeyword[] }> {
    throw new Error('Service.getQueue not implemented');
  }

  async startSession(keyword: string): Promise<StartSessionResult> {
    throw new Error(
      `Service.startSession not implemented (keyword: ${keyword})`,
    );
  }

  async resumeSession(
    threadId: string,
    decision: HumanDecision,
  ): Promise<ResumeSessionResult> {
    throw new Error(
      `Service.resumeSession not implemented (threadId: ${threadId}, decision.path: ${decision.path})`,
    );
  }
}
