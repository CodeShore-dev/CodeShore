import { Module as ModuleDecorator } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { Controller } from './controller';

@ModuleDecorator({
  imports: [TerminusModule],
  controllers: [Controller],
})
export class Module {}
