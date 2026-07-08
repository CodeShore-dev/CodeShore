import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsObject, IsOptional, IsString } from 'class-validator';

import {
  AiSuggestionStatus,
  AiSuggestionTargetTable,
  AiSuggestionWorkflow,
} from '@codeshore/data-types';

import { QueryDto } from '../query.dto';

/** `AiSuggestionTargetTable`'s member list, kept in sync manually since
 * `@IsIn` needs a runtime array (the type itself only exists at
 * compile-time). Mirrors `libs/data-types/src/lib/supabase.@types.ts`. */
const TARGET_TABLES: AiSuggestionTargetTable[] = [
  'job_description_bin',
  'tech',
  'keyword_bin',
  'tech_keyword',
  'tech_parent',
  'location_group',
  'location_group_location',
];

/** `AiSuggestionStatus`'s member list, same rationale as `TARGET_TABLES`. */
const STATUSES: AiSuggestionStatus[] = ['pending', 'approved', 'rejected'];

/**
 * Query DTO for `GET /ai-suggestion` (requirement 7.1: 依目標資料表、狀態
 * 篩選待審建議清單). Extends the shared `QueryDto` for pagination/sorting/
 * generic `where`, the same way `admin/dto.ts`'s `LocationAnomalyDto` does.
 */
export class AiSuggestionQueryDto extends QueryDto {
  @ApiPropertyOptional({
    enum: TARGET_TABLES,
    description: 'Filter by the suggestion\'s target table',
  })
  @IsOptional()
  @IsIn(TARGET_TABLES)
  targetTable?: AiSuggestionTargetTable;

  @ApiPropertyOptional({
    enum: STATUSES,
    description: 'Filter by suggestion status',
  })
  @IsOptional()
  @IsIn(STATUSES)
  status?: AiSuggestionStatus;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description:
      'Inclusive lower bound (ISO-8601) on created_at, for requirement ' +
      '10.2\'s 依時間範圍查詢歷史建議紀錄 history query',
  })
  @IsOptional()
  @IsISO8601()
  createdAfter?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description:
      'Inclusive upper bound (ISO-8601) on created_at, for requirement ' +
      '10.2\'s 依時間範圍查詢歷史建議紀錄 history query',
  })
  @IsOptional()
  @IsISO8601()
  createdBefore?: string;
}

/**
 * Body DTO for `PATCH /ai-suggestion/:id/approve` (requirement 7.4: 允許
 * 維運者在核准前修改建議內容，修改後的內容才是實際落地的內容). `editedPayload`'s
 * shape varies per `target_table` (7 different target tables, each with its
 * own column set), so it is validated permissively as an open-ended object
 * rather than a per-table schema -- the same approach `QueryDto.where` uses
 * for its own open-ended JSON body.
 */
export class ApproveSuggestionDto {
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'Reviewer-edited payload to land instead of the originally suggested payload. Shape depends on the suggestion\'s target_table.',
    example: { name: 'react', display_name: 'React' },
  })
  @IsOptional()
  @IsObject()
  editedPayload?: Record<string, unknown>;
}

/**
 * Body DTO for `PATCH /ai-suggestion/:id/reject` (requirement 7.3).
 */
export class RejectSuggestionDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Optional reviewer note explaining the rejection',
  })
  @IsOptional()
  @IsString()
  note?: string;
}

/** `AiSuggestionWorkflow`'s member list, same rationale as `TARGET_TABLES`. */
const WORKFLOWS: AiSuggestionWorkflow[] = [
  'keyword_mapping',
  'tech_dictionary',
  'tech_hierarchy',
  'location_mapping',
  'noise_detection',
];

const WORKFLOWS_OR_ALL: ReadonlyArray<AiSuggestionWorkflow | 'all'> = [
  ...WORKFLOWS,
  'all',
];

/**
 * Query DTO for `GET /ai-suggestion/generate` (requirement 1.2: 開放一個可
 * 指定單一子工作流或全部子工作流的產生路由). Uses `@Query()` (not a request
 * body) since this is an `@Sse()` route -- mirrors `admin/controller.ts`'s
 * `@Sse('crawl')`/`@Sse('refresh-mv')` routes, both of which take
 * `@Query()` DTOs rather than bodies (a standard browser `EventSource` can
 * only issue GET requests, so `@Sse()` routes never take a request body).
 */
export class GenerateSuggestionsDto {
  @ApiPropertyOptional({
    enum: WORKFLOWS_OR_ALL,
    default: 'all',
    description:
      'Which sub-workflow to run, or "all" to run every workflow in a fixed order. Defaults to "all" when omitted.',
  })
  @IsOptional()
  @IsIn(WORKFLOWS_OR_ALL as string[])
  workflow?: AiSuggestionWorkflow | 'all';
}
