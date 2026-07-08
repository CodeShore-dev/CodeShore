import { Module as ModuleDecorator } from '@nestjs/common';

import {
  TechService,
  TechKeywordService,
  TechParentService,
  KeywordService,
  MvTechCategoryService,
  MvTechService,
} from '@codeshore/data-utils';

import { provideWithLogger } from '../logger-provider';
import { Controller } from './controller';
import { Service } from './service';

@ModuleDecorator({
  imports: [],
  controllers: [Controller],
  providers: [
    Service,
    provideWithLogger(TechService),
    provideWithLogger(TechKeywordService),
    provideWithLogger(TechParentService),
    provideWithLogger(KeywordService),
    provideWithLogger(MvTechService),
    provideWithLogger(MvTechCategoryService),
  ],
})
export class Module {}
