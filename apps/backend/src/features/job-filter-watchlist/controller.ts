import {
  Body,
  Controller as ControllerDecorator,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@supabase/supabase-js';
import { Response } from 'express';

import { CurrentUser } from '../auth/auth.decorator';
import { CreateJobFilterSubscriptionDto } from './dto';
import { Service } from './service';

const name = 'job-filter-watchlist';

/**
 * `POST`'s conditional 201/200/409 status codes (design.md "job-filter-watchlist
 * Controller" table) cannot be produced via this repo's normal
 * "return a value, let Nest apply the route's default status" convention
 * (used by every other controller in this backend, e.g. `job/controller.ts`),
 * nor via throwing a NestJS `HttpException`/`ConflictException`. Both were
 * tried and traced through this repo's actual infra before settling on the
 * `@Res()` approach below:
 *
 * 1. `libs/service-transport/src/inbound.interceptor.ts` is registered
 *    globally (`main.ts` -> `createApp`) and wraps every successful
 *    controller return value in a fixed `{ code: HttpStatus.OK, message:
 *    undefined, data }` envelope -- so a plain `return subscription` always
 *    reports envelope `code: 200`, regardless of the real HTTP status.
 * 2. Nest's `RouterExecutionContext`/`RouterResponseController` (see
 *    `@nestjs/core/router/router-execution-context.js`) resolve the route's
 *    HTTP status *once*, at route-registration time, from `@HttpCode()`
 *    metadata or the method-based default (201 for POST) -- then *always*
 *    re-applies that fixed status via `response.status(...)` when handing
 *    off the result, even when `@Res({ passthrough: true })` was used and
 *    the handler already called `res.status(...)` itself. A manual
 *    `res.status(200)` inside the handler is silently clobbered back to 201
 *    by this repo's Nest version (traced in
 *    `@nestjs/platform-express/adapters/express-adapter.js`'s `reply()`).
 *    There is therefore no way to differentiate 201 vs 200 per-request
 *    without disabling Nest's own response handling entirely.
 * 3. For the 409 case, `libs/service-transport/src/all-exceptions.filter.ts`
 *    (also global) rewrites *every* `HttpException` response body to a fixed
 *    `{ code: ServiceCode.DefaultFailed, message }` shape, discarding any
 *    other property -- so `throw new ConflictException({ code:
 *    'WATCHLIST_LIMIT_REACHED', limit })` cannot deliver design.md's exact
 *    `{ code: 'WATCHLIST_LIMIT_REACHED', limit }` body; only `message`
 *    survives, and `limit` is lost.
 *
 * `@Res({ passthrough: false })` is the sanctioned escape hatch the task
 * brief calls out for exactly this situation: it disables Nest's automatic
 * response application for this one handler, so nothing above stomps on it.
 * The success branches still wrap their body as `{ data: subscription }` to
 * stay compatible with the frontend's shared `httpClient` (see
 * `apps/frontend/src/httpClient/interceptors/onResponse/transformResponse.ts`,
 * which unconditionally reads `response.data.data` on every successful
 * response) -- only the *status code* differs per-branch, not the envelope
 * shape success responses are otherwise wrapped in. The 409 body is sent
 * unwrapped, verbatim, matching design.md exactly: axios does not run
 * `transformResponse` on rejected (error) responses, so a future frontend
 * consumer reads it straight off `error.response.data`.
 */
@ApiBearerAuth()
@ApiTags(name)
@ControllerDecorator(name)
export class Controller {
  constructor(@Inject(Service) private readonly service: Service) {}

  @Post()
  @ApiOperation({
    summary: 'Follow the currently applied filter combination',
    description:
      'Creates a new followed filter combination for the current user (201). If an equivalent combination is already followed, returns it unchanged instead of creating a duplicate (200). Returns 409 with { code: "WATCHLIST_LIMIT_REACHED", limit } when the user is at their subscription cap.',
  })
  async create(
    @Body() body: CreateJobFilterSubscriptionDto,
    @CurrentUser() user: User,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const result = await this.service.create(user.id, body);

    if (result.status === 'limit_reached') {
      res
        .status(HttpStatus.CONFLICT)
        .json({ code: 'WATCHLIST_LIMIT_REACHED', limit: result.limit });
      return;
    }

    const status =
      result.status === 'created' ? HttpStatus.CREATED : HttpStatus.OK;
    res
      .status(status)
      .json({ code: HttpStatus.OK, message: undefined, data: result.subscription });
  }

  @Get()
  @ApiOperation({
    summary: "List the current user's followed filter combinations",
    description:
      'Returns every filter combination the current user follows, each enriched with its computed totalCount/newCount and lastViewedAt.',
  })
  async list(@CurrentUser() user: User) {
    return this.service.list(user.id);
  }

  @Patch(':id/viewed')
  @ApiOperation({
    summary: 'Mark a followed filter combination as just viewed',
    description:
      "Updates the subscription's last_viewed_at to now (so its newCount recomputes going forward) and returns the refreshed subscription. 404 when the id does not exist or is not owned by the current user.",
  })
  @ApiParam({ name: 'id', description: 'The subscription id' })
  async markViewed(@Param('id') id: string, @CurrentUser() user: User) {
    const result = await this.service.markViewed(user.id, id);
    if (!result) {
      throw new NotFoundException();
    }
    return result;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Unfollow a filter combination',
    description:
      "Removes the subscription from the current user's followed list (204). 404 when the id does not exist or is not owned by the current user.",
  })
  @ApiParam({ name: 'id', description: 'The subscription id' })
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    const deleted = await this.service.remove(user.id, id);
    if (!deleted) {
      throw new NotFoundException();
    }
  }
}
