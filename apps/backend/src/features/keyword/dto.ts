import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateIconSlugsDto {
  @ApiProperty({
    type: String,
    description: 'The keyword group id',
    example: 'react',
  })
  @IsString()
  id!: string;

  @ApiProperty({
    type: [String],
    description:
      "Ordered icon sources for the keyword group, each as 'source:slug'. Earlier = higher priority.",
    example: ['thesvg:react', 'simple-icons:react'],
  })
  @IsArray()
  @IsString({ each: true })
  icon_slugs!: string[];
}

/**
 * Body DTO for `POST /keyword/group` (task 4.1, requirement 7.5's manual-edit
 * fallback for the tech dictionary). `category`/`parent` are `string | null`
 * per `apps/frontend/src/features/keyword/service.ts`'s `createTech`
 * contract -- `@IsOptional()` is used deliberately here even though both
 * fields are required in the request shape, because class-validator's
 * `@IsOptional()` skips the following validators specifically when the value
 * is `null` (not only when `undefined`), which is exactly the "allow a
 * literal null, but validate as a string otherwise" behavior this nullable
 * field needs; there is no dedicated "required but nullable" decorator in
 * this codebase's existing dto.ts files to mirror instead.
 */
export class CreateTechDto {
  @ApiProperty({
    type: String,
    description: 'The new tech id',
    example: 'react',
  })
  @IsString()
  id!: string;

  @ApiProperty({
    type: [String],
    description:
      'Keywords to map to this tech on creation. May be empty.',
    example: ['react', 'reactjs'],
  })
  @IsArray()
  @IsString({ each: true })
  keywords!: string[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The tech category',
    example: 'frontend',
  })
  @IsOptional()
  @IsString()
  category!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The parent tech id, or null for no parent',
    example: 'javascript',
  })
  @IsOptional()
  @IsString()
  parent!: string | null;
}

/**
 * Body DTO for `PATCH /keyword/group/:id` (task 4.1, requirement 7.5). Every
 * field is genuinely optional here -- only provided fields are changed
 * (`Service.updateTech` distinguishes "field omitted" from "field explicitly
 * set to null" via `undefined` checks, so `@IsOptional()` here means what it
 * says for both `undefined`-omission and, for `category`/`parent`, literal
 * `null`).
 */
export class UpdateTechDto {
  @ApiPropertyOptional({
    type: [String],
    description:
      "Replaces the tech's full keyword-mapping set. Omit to leave keywords unchanged.",
    example: ['react', 'reactjs'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'The new tech category. Omit to leave the category unchanged.',
    example: 'frontend',
  })
  @IsOptional()
  @IsString()
  category?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      "The new parent tech id, or null to remove the tech's parent relationship. Omit to leave the parent unchanged.",
    example: 'javascript',
  })
  @IsOptional()
  @IsString()
  parent?: string | null;
}
