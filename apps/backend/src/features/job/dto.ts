import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import {
  DEFAULT_PREFERENCE_REASON,
  MAX_PREFERENCE_REASON_LENGTH,
} from '@codeshore/shared-utils';

/**
 * Body DTO for `PATCH /api/job/preference/:jobId/:preference`
 * (design.md "Backend：Job Controller / Service"). `reason` is optional so an
 * old frontend that sends `{}` (or no body) keeps working. Only the type is
 * checked here; trimming and the 1–20 length rule are applied by
 * `Service.setJobPreference` via `normalizeReason`, which returns a 400.
 */
export class SetJobPreferenceDto {
  @ApiProperty({
    type: String,
    required: false,
    description: `Reason (sub-category) for this mark. Leading/trailing whitespace is trimmed; must be 1-${MAX_PREFERENCE_REASON_LENGTH} characters after trimming. Defaults to "${DEFAULT_PREFERENCE_REASON}" when omitted.`,
    example: '技能已符合',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
