import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class QueryDto {
  @ApiPropertyOptional({
    type: Number,
    minimum: 0,
    description: 'Number of items to skip [default: 0]',
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  from?: number = 0;

  @ApiPropertyOptional({
    type: Number,
    minimum: -1,
    description:
      'Maximum number of items to return; -1 means no upper bound (fetch all) [default: 10]',
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-1)
  to?: number = 10;

  @ApiPropertyOptional({
    type: String,
    description:
      'Field to sort by and direction in "field:asc" or "field:desc" format [default: asc], even multiple order(fieldA:asc;fieldB:desc;...)',
    example: 'count:desc;title:asc',
  })
  @IsOptional()
  @IsArray()
  @Type(() => String)
  @Transform(({ value }) => {
    try {
      return ((value?.split(';') as string[]) ?? []).map(
        x => {
          const [field, direction = 'asc'] = x.split(':');
          return {
            column: field as any,
            ascending: direction === 'asc',
          };
        },
      );
    } catch (error) {
      throw new Error('Invalid in "orders" ' + value);
    }
  })
  orders: {
    column: string;
    ascending: boolean;
  }[] = [];

  @ApiPropertyOptional({
    type: String,
    description:
      'JSON string for Supabase filter conditions. Keys are column names (or $or/$and), values are operator-value pairs. Example: {"title": {"ilike": "%codeshore%"}, "salary": {"gte": 50000}, "$or": "title.eq.Manager,description.ilike.%Manager%", "$and": "tags.cs.{Vue.js,React.js}", "$and": "tags.ov.{Python,Vue.js}"}',
    example: '{"title":{"ilike":"%react%"},"salary":{"gte":50000}}',
  })
  @IsOptional()
  @IsObject()
  @Transform(({ value }) => {
    try {
      if (typeof value === 'string') {
        return JSON.parse(value);
      }
      return value;
    } catch (error) {
      throw new Error('Invalid JSON in "where" ' + value);
    }
  })
  where: Record<string, any> = {};
}
