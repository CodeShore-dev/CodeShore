import { Module as ModuleDecorator } from '@nestjs/common';

import {
  AiSuggestionService,
  JobDescriptionBinService,
  KeywordBinService,
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
  ],
})
export class Module {}
