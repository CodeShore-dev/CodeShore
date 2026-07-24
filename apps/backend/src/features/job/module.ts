import { Module as ModuleDecorator } from '@nestjs/common';

import {
  JobPreferenceService,
  MvJobService,
  MvLocationGroupService,
  MvLocationSalaryService,
  MvLocationTechService,
} from '@codeshore/data-utils';

import { provideWithLogger } from '../logger-provider';
import { Controller } from './controller';
import { Service } from './service';

@ModuleDecorator({
  imports: [],
  controllers: [Controller],
  providers: [
    Service,
    provideWithLogger(JobPreferenceService),
    provideWithLogger(MvLocationGroupService),
    provideWithLogger(MvJobService),
    provideWithLogger(MvLocationTechService),
    provideWithLogger(MvLocationSalaryService),
  ],
})
export class Module {}
