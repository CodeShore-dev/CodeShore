import { Module as ModuleDecorator } from '@nestjs/common';

import {
  AiLlmSettingService,
  AiSuggestionService,
  JobDescriptionBinService,
  JobKeywordService,
  JobService,
  KeywordBinService,
  KeywordService,
  LocationGroupLocationService,
  LocationGroupService,
  MvLocationGroupService,
  MvTechService,
  TechKeywordService,
  TechParentService,
  TechService,
} from '@codeshore/data-utils';

import { provideWithLogger } from '../logger-provider';
import { Controller } from './controller';
import { Service } from './service';

// Note: unlike the removed `AnthropicLlmClient`, `OpenRouterLlmClient`
// (`llm-client.ts`) is intentionally NOT registered as a provider here --
// its constructor takes a required `model: string`, decided per
// `generate()` call (per-call override, else the `ai_llm_setting` table's
// `default_model`, else `Service.DEFAULT_MODEL_FALLBACK`), so it can no
// longer be a stable DI singleton. `Service.generate()` constructs a fresh
// instance itself once the effective model for that run is resolved.
@ModuleDecorator({
  imports: [],
  controllers: [Controller],
  providers: [
    Service,
    provideWithLogger(AiSuggestionService),
    provideWithLogger(JobDescriptionBinService),
    provideWithLogger(TechService),
    provideWithLogger(KeywordBinService),
    provideWithLogger(TechKeywordService),
    provideWithLogger(TechParentService),
    provideWithLogger(LocationGroupService),
    provideWithLogger(LocationGroupLocationService),
    provideWithLogger(MvTechService),
    provideWithLogger(MvLocationGroupService),
    provideWithLogger(KeywordService),
    provideWithLogger(JobKeywordService),
    provideWithLogger(JobService),
    provideWithLogger(AiLlmSettingService),
  ],
})
export class Module {}
