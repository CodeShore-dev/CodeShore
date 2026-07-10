import { Module as ModuleDecorator } from '@nestjs/common';

import {
  JobKeywordService,
  KeywordBinService,
  KeywordService,
  TechKeywordService,
} from '@codeshore/data-utils';

import { provideWithLogger } from '../logger-provider';
import { Controller } from './controller';
import { Service } from './service';

/**
 * Requirement 2.1 / design.md's file structure plan. Task 4.1 adds the 4
 * data-utils providers `Service.getQueue()` now needs
 * (`KeywordService`/`TechKeywordService`/`KeywordBinService`/
 * `JobKeywordService`), registered via `provideWithLogger(...)` -- the same
 * convention `ai-suggestion/module.ts` uses for every data-utils provider it
 * registers. The LangGraph providers `startSession`/`resumeSession` (task
 * 4.2) need are still not wired here.
 */
@ModuleDecorator({
  imports: [],
  controllers: [Controller],
  providers: [
    Service,
    provideWithLogger(KeywordService),
    provideWithLogger(TechKeywordService),
    provideWithLogger(KeywordBinService),
    provideWithLogger(JobKeywordService),
  ],
})
export class Module {}
