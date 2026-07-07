import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

import { MV_REFRESH_STEP_IDS } from '@codeshore/data-utils';

import { QueryDto } from '../query.dto';
import {
  AnomalyKind,
  CrawlMode,
} from './service';

export class UpdateSalaryDto {
  @ApiPropertyOptional({ description: 'Manual min salary' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  min_salary!: number;

  @ApiPropertyOptional({ description: 'Manual max salary' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_salary!: number;

  @ApiPropertyOptional({
    enum: ['month', 'year'],
    description: 'Manual salary type',
  })
  @IsIn(['month', 'year'])
  salary_type!: 'month' | 'year';
}

export class StatsDto {
  @ApiPropertyOptional({
    description:
      'Window in days to count new / recently-updated jobs (counted back from the latest date)',
    default: 7,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  days: number = 7;
}

export class SalaryAnomalyDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Monthly max_salary above this is anomalous',
    default: 1000000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  monthCeil: number = 1000000;

  @ApiPropertyOptional({
    description: 'Yearly max_salary above this is anomalous',
    default: 12000000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  yearCeil: number = 12000000;
}

export class LocationAnomalyDto extends QueryDto {
  @ApiPropertyOptional({
    enum: ['blank', 'unmapped', 'malformed'],
    default: 'unmapped',
  })
  @IsOptional()
  @IsIn(['blank', 'unmapped', 'malformed'])
  type: 'blank' | 'unmapped' | 'malformed' = 'unmapped';

  @ApiPropertyOptional({
    description: 'Location longer than this is malformed',
    default: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxLen: number = 30;
}

export class CrawlDto {
  @ApiPropertyOptional({
    enum: [
      'crawl',
      'fresh',
      'recrawl-ids',
      'recrawl-anomaly',
      'recrawl-cond',
      'recrawl-dates',
    ],
  })
  @IsIn([
    'crawl',
    'fresh',
    'recrawl-ids',
    'recrawl-anomaly',
    'recrawl-cond',
    'recrawl-dates',
  ])
  mode!: CrawlMode;

  @ApiPropertyOptional({
    description: 'Comma-separated job ids (mode=recrawl-ids)',
  })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      : (value ?? []),
  )
  ids?: string[];

  @ApiPropertyOptional({
    description:
      'Comma-separated updated_at dates YYYY-MM-DD (mode=recrawl-dates)',
  })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      : (value ?? []),
  )
  dates?: string[];

  @ApiPropertyOptional({
    enum: [
      'salary',
      'empty-description',
      'location-blank',
      'location-unmapped',
      'location-malformed',
    ],
    description: 'Anomaly kind (mode=recrawl-anomaly)',
  })
  @IsOptional()
  @IsString()
  kind?: AnomalyKind;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  monthCeil?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  yearCeil?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxLen?: number;

  @ApiPropertyOptional({
    description:
      'Crawler where expression for mode=recrawl-cond, e.g. ' +
      '"updated_at.lt.2026-05-01,salary_type.eq.month". ' +
      'Columns/operators are whitelisted server-side.',
  })
  @IsOptional()
  @IsString()
  where?: string;
}

export class RefreshMvDto {
  @ApiPropertyOptional({
    enum: MV_REFRESH_STEP_IDS,
    description:
      'Resume the mv-refresh pipeline from this step id, skipping already-completed ' +
      'steps before it. Omit to run the full pipeline from the start.',
  })
  @IsOptional()
  @IsIn(MV_REFRESH_STEP_IDS)
  from?: string;
}
