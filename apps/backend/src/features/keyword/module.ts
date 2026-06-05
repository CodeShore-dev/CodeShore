import { Module as ModuleDecorator } from '@nestjs/common';

import {
  MvKeywordGroupCategoryService,
  MvKeywordGroupRankingService,
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
    provideWithLogger(MvKeywordGroupService),
    provideWithLogger(MvKeywordGroupCategoryService),
    provideWithLogger(MvKeywordGroupRankingService),
  ],
})
export class Module {}
