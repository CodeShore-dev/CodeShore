import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

/**
 * Validated at boot via ConfigModule.forRoot({ validate }) so a missing
 * Supabase credential fails the process immediately instead of surfacing
 * later as "Missing Supabase credentials" on the first request that happens
 * to touch getSupabaseClient() (libs/supabase/src/lib/supabase.ts).
 *
 * Only the backend-specific / required-at-boot variables are declared here.
 * Shared libs (ai-client, crawler-core, supabase) keep reading process.env
 * directly rather than via ConfigService, because they're also consumed by
 * the crawler app, which is not a Nest application and has no DI container.
 */
class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  SUPABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  SUPABASE_SERVICE_ROLE_KEY!: string;

  @IsOptional()
  @IsString()
  REPO?: string;

  @IsOptional()
  @IsString()
  VER?: string;

  @IsOptional()
  @IsString()
  ADMIN_EMAILS?: string;

  @IsOptional()
  @IsString()
  OPENROUTER_API_KEY?: string;

  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV?: string;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map(error => Object.values(error.constraints ?? {}).join(', '))
      .join('\n');
    throw new Error(`Invalid environment variables:\n${details}`);
  }

  return validated;
}
