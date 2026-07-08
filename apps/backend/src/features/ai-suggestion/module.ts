import { Module as ModuleDecorator } from '@nestjs/common';

import {
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
import { AnthropicLlmClient } from './llm-client';
import { Service } from './service';

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
    // Not constructed via `provideWithLogger`: `AnthropicLlmClient`'s
    // constructor takes an optional `model?: string`, not a `ServiceLogger`
    // (see `llm-client.ts`) -- `provideWithLogger`'s factory always injects
    // `ServiceLogger` as the sole constructor argument, which is the wrong
    // shape here. A plain `useFactory` provider sidesteps NestJS's
    // reflection-based constructor-param resolution entirely (which would
    // otherwise try, and fail, to resolve a provider for the `string`
    // token), so the model always falls back to its
    // `ANTHROPIC_MODEL`/`DEFAULT_MODEL` env-driven default.
    { provide: AnthropicLlmClient, useFactory: () => new AnthropicLlmClient() },
  ],
})
export class Module {}
