import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsString } from 'class-validator';

import { JobFilterSnapshot } from '@codeshore/shared-utils';

/**
 * Body DTO for `POST /api/job-filter-watchlist` (design.md "job-filter-watchlist
 * Controller" table). `filterSnapshot`/`filterWhere` are validated
 * permissively as open-ended objects -- the same approach `QueryDto.where`
 * and `ApproveSuggestionDto.editedPayload` use for structures whose exact
 * shape is owned by another module (`JobFilterSnapshot` lives in
 * `shared-utils`; `filterWhere` is `deriveJobWhere`'s PostgREST-style
 * output, owned by `features/job`, out of this feature's boundary per
 * design.md's Boundary Commitments). Deep per-field validation of
 * `filterSnapshot` is intentionally not attempted here: `Service.create`
 * (task 2.1) already normalizes it via `normalizeFilterSnapshot` before use.
 */
export class CreateJobFilterSubscriptionDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'The currently applied filter combination (JobFilterSnapshot shape) to follow.',
  })
  @IsObject()
  filterSnapshot!: JobFilterSnapshot;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      "PostgREST-style where object computed by the frontend's deriveJobWhere for the current filters.",
  })
  @IsObject()
  filterWhere!: Record<string, unknown>;

  @ApiProperty({
    type: String,
    description:
      'Auto-generated description text for this filter combination (produced by the frontend describeFilterSnapshot).',
  })
  @IsString()
  label!: string;
}
