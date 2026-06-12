import { Module as ModuleDecorator } from '@nestjs/common';

import {
  KeywordGroupService,
  MvKeywordGroupCategoryService,
  MvKeywordGroupService,
} from '@codeshore/data-utils';

import { provideWithLogger } from '../logger-provider';
import { Controller } from './controller';
import { Service } from './service';

@ModuleDecorator({
  imports: [],
  controllers: [Controller],
  providers: [
    Service,
    provideWithLogger(KeywordGroupService),
    provideWithLogger(MvKeywordGroupService),
    provideWithLogger(MvKeywordGroupCategoryService),
  ],
})
export class Module {}
