import { Module as ModuleDecorator } from '@nestjs/common';

import { MvCompanyService } from '@codeshore/data-utils';

import { provideWithLogger } from '../logger-provider';
import { Controller } from './controller';
import { Service } from './service';

@ModuleDecorator({
  imports: [],
  controllers: [Controller],
  providers: [Service, provideWithLogger(MvCompanyService)],
})
export class Module {}
