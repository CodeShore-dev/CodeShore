import {
  Body,
  ConflictException,
  Controller as ControllerDecorator,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Query,
  BadRequestException,
  Sse,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '@supabase/supabase-js';
import { Observable } from 'rxjs';

import { AdminOnly, CurrentUser } from '../auth/auth.decorator';
import {
  AiSuggestionQueryDto,
  ApproveSuggestionDto,
  GenerateSuggestionsDto,
  RejectSuggestionDto,
} from './dto';
import { Service } from './service';

const name = 'ai-suggestion';

/**
 * Requirement 7.1-7.4 / design.md's `AiSuggestionController`: 對外路由與
 * `@AdminOnly()` 保護. This is a thin decorator layer over the already
 * fully-tested `Service` (tasks 2.1-2.3) -- it does not reimplement any
 * queue/approve/reject logic, only maps HTTP requests to `Service` calls
 * and `Service`'s discriminated `ok`/`error` results to HTTP responses.
 */
@ApiBearerAuth()
@ApiTags(name)
@AdminOnly()
@ControllerDecorator(name)
export class Controller {
  constructor(private readonly service: Service) {}

  @Get()
  @ApiOperation({
    summary: 'List AI suggestions (requirement 7.1, 10.2)',
    description:
      'Lists suggestions in the review queue, optionally filtered by targetTable, status, and/or a createdAfter/createdBefore time range (requirement 10.2\'s 依目標資料表或時間範圍查詢歷史建議紀錄). Supports the shared QueryDto pagination/sorting/where params.',
  })
  async list(@Query() query: AiSuggestionQueryDto) {
    return this.service.list({
      targetTable: query.targetTable,
      status: query.status,
      createdAfter: query.createdAfter,
      createdBefore: query.createdBefore,
    });
  }

  @Sse('generate')
  @ApiOperation({
    summary:
      'Generate AI suggestions for one sub-workflow or all of them, streaming progress via SSE (requirement 1.2)',
    description:
      'Pass ?workflow=<keyword_mapping|tech_dictionary|tech_hierarchy|location_mapping|noise_detection|all> (defaults to "all"). A single sub-workflow failing does not stop the others from running.',
  })
  generate(@Query() query: GenerateSuggestionsDto): Observable<MessageEvent> {
    return this.service.generateStream(query.workflow ?? 'all');
  }

  // NOTE: `getById`'s `:id` route is registered *after* `generate` above.
  // `@Sse()` routes are always GET (see @nestjs/common's `sse.decorator.js`),
  // and NestJS registers Express routes in class declaration order -- if
  // `:id` were declared first, `GET /ai-suggestion/generate` would be
  // shadowed by `GET /ai-suggestion/:id` (with `id === "generate"`) instead
  // of ever reaching this SSE handler.
  @Get(':id')
  @ApiOperation({
    summary: 'Get a single AI suggestion by id (requirement 7.2)',
  })
  async getById(@Param('id') id: string) {
    const result = await this.service.getById(id);
    if (!result.found) {
      throw new NotFoundException(
        `No suggestion found for id "${id}"`,
      );
    }
    return result.record;
  }

  @Patch(':id/approve')
  @ApiOperation({
    summary: 'Approve a pending suggestion (requirement 7.3, 7.4)',
    description:
      'Transitions a pending suggestion to approved and lands it on its target table. An optional editedPayload in the body overrides the originally suggested payload (requirement 7.4).',
  })
  async approve(
    @Param('id') id: string,
    @Body() body: ApproveSuggestionDto,
    @CurrentUser() user: User,
  ) {
    const result = await this.service.approve(
      id,
      body.editedPayload,
      user.id,
    );
    if (!result.ok) {
      throw this.toHttpException(result.error);
    }
    return result.record;
  }

  @Patch(':id/reject')
  @ApiOperation({
    summary: 'Reject a pending suggestion (requirement 7.3)',
    description:
      'Transitions a pending suggestion to rejected. Never writes to any target table. An optional note in the body records the reviewer\'s reasoning.',
  })
  async reject(
    @Param('id') id: string,
    @Body() body: RejectSuggestionDto,
    @CurrentUser() user: User,
  ) {
    const result = await this.service.reject(id, body.note, user.id);
    if (!result.ok) {
      throw this.toHttpException(result.error);
    }
    return result.record;
  }

  /**
   * Maps `Service.approve`/`Service.reject`'s discriminated error `kind`
   * to the corresponding HTTP exception. `conflict` -> 409 is explicit in
   * design.md's approve sequence diagram ("Service-->>Controller: 409
   * Conflict, status stays pending"); the remaining kinds follow standard
   * REST semantics for the same discriminated-union shape.
   */
  private toHttpException(error: {
    kind: 'conflict' | 'validation' | 'write_failed' | 'not_found';
    message: string;
  }) {
    switch (error.kind) {
      case 'not_found':
        return new NotFoundException(error.message);
      case 'validation':
        return new BadRequestException(error.message);
      case 'conflict':
        return new ConflictException(error.message);
      case 'write_failed':
        return new InternalServerErrorException(error.message);
    }
  }
}
