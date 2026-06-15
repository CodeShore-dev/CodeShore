import { Module as ModuleDecorator } from '@nestjs/common';

import { JobService } from '@codeshore/data-utils';

import { provideWithLogger } from '../logger-provider';
import { Controller } from './controller';
import { Service } from './service';

@ModuleDecorator({
  imports: [],
  controllers: [Controller],
  providers: [Service, provideWithLogger(JobService)],
})
export class Module {}
