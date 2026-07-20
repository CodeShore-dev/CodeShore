import {
  BadRequestException,
  Body,
  Controller as ControllerDecorator,
  Get,
  Inject,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminOnly } from '../auth/auth.decorator';
import type { HumanDecision } from './graph.types';
import { Service } from './service';

const name = 'keyword-curation';

/**
 * Requirement 2.1 / design.md's `KeywordCurationController`: 3 routes, all
 * `@AdminOnly()`. This is a thin decorator layer over `Service` -- it does
 * not reimplement any queue/session logic, only maps HTTP requests to
 * `Service` calls (task 4.1/4.2 fill in `Service`'s real behavior; this task
 * only wires the skeleton and confirms the guard rejects unauthenticated
 * requests).
 */
@ApiBearerAuth()
@ApiTags(name)
@AdminOnly()
@ControllerDecorator(name)
export class Controller {
  constructor(@Inject(Service) private readonly service: Service) {}

  @Get('queue')
  @ApiOperation({
    summary: 'List unmapped keywords eligible for curation',
    description:
      'Requirement 1.1-1.3: keywords at/above the count threshold, not yet mapped to a tech, and not in keyword_bin, ordered by count desc. Paginated via ?page (1-based, default 1) and ?pageSize (default 10).',
  })
  async getQueue(
    @Query('page') pageParam?: string,
    @Query('pageSize') pageSizeParam?: string,
  ) {
    const page = pageParam ? Number(pageParam) : 1;
    const pageSize = pageSizeParam ? Number(pageSizeParam) : undefined;
    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException('page must be a positive integer');
    }
    if (
      pageSize !== undefined &&
      (!Number.isInteger(pageSize) || pageSize < 1)
    ) {
      throw new BadRequestException('pageSize must be a positive integer');
    }
    return this.service.getQueue(page, pageSize);
  }

  @Post('bulk-bin')
  @ApiOperation({
    summary: 'Bulk-exclude multiple keywords into keyword_bin',
    description:
      'Marks every given keyword as noise (path C), skipping the per-keyword AI-analysis/human-decision session, for an admin rejecting several keywords at once from the queue.',
  })
  async bulkExcludeKeywords(@Body('keywords') keywords: string[]) {
    const result = await this.service.bulkExcludeKeywords(keywords ?? []);
    if (!result.ok) {
      throw new InternalServerErrorException(result.error);
    }
    return { ok: true };
  }

  @Post('session')
  @ApiOperation({
    summary: 'Start a curation session for one keyword',
    description:
      'Requirement 2.1: runs the LangGraph curation graph for the given keyword up to its first interrupt() and returns the AI recommendation for human review.',
  })
  async startSession(@Body('keyword') keyword: string) {
    const result = await this.service.startSession(keyword);
    if (!result.ok) {
      throw new InternalServerErrorException(result.error);
    }
    return { threadId: result.threadId, interrupt: result.interrupt };
  }

  @Post('session/:threadId/resume')
  @ApiOperation({
    summary: "Resume a curation session with the admin's decision",
    description:
      'Requirement 4.1, 5.2, 6.7, 7.2: resumes the graph at its interrupt with the confirmed path A/B/C decision and runs it to completion, committing the corresponding database writes.',
  })
  async resumeSession(
    @Param('threadId') threadId: string,
    @Body('decision') decision: HumanDecision,
  ) {
    const result = await this.service.resumeSession(threadId, decision);
    if (!result.ok) {
      throw this.toHttpException(result);
    }
    // design.md's HTTP contract (POST /keyword-curation/session/:threadId/resume,
    // 200 response): `{ status: 'done'; result: CommitResult }`.
    return { status: 'done' as const, result: result.result };
  }

  /**
   * Maps `Service.resumeSession`'s discriminated `ok: false` error to the
   * corresponding HTTP exception, following the same per-`kind`/`error`
   * mapping convention as `ai-suggestion/controller.ts`'s own
   * `toHttpException`. `thread_not_found` -> 404 is explicit in design.md's
   * HTTP contract ("Response (404) — threadId not found in MemorySaver");
   * `graph_error` covers any other unexpected failure (an infra error, or a
   * commit node's "impossible state" throw) surfaced as 500, since none of
   * those are the client's fault to correct and retry with a different
   * request shape.
   */
  private toHttpException(result: {
    ok: false;
    error: 'thread_not_found' | 'graph_error';
    message: string;
  }) {
    switch (result.error) {
      case 'thread_not_found':
        return new NotFoundException(result.message);
      case 'graph_error':
        return new InternalServerErrorException(result.message);
    }
  }
}
