import { Module as ModuleDecorator } from '@nestjs/common';

import { Controller } from './controller';
import { Service } from './service';

@ModuleDecorator({
  imports: [],
  controllers: [Controller],
  providers: [Service],
})
export class Module {}
