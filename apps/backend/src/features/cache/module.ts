import { Module as ModuleDecorator } from '@nestjs/common';

import { Controller } from './controller';

@ModuleDecorator({
  controllers: [Controller],
})
export class Module {}
