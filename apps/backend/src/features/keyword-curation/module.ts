import { Module as ModuleDecorator } from '@nestjs/common';

import { Controller } from './controller';
import { Service } from './service';

/**
 * Requirement 2.1 / design.md's file structure plan. Skeleton wiring only
 * (task 1.2) -- later tasks (3.x graph nodes, 4.1/4.2 service methods) will
 * add the LangGraph/data-utils providers this feature needs; for now
 * `Service`'s methods are unimplemented placeholders, so no extra providers
 * are required yet.
 */
@ModuleDecorator({
  imports: [],
  controllers: [Controller],
  providers: [Service],
})
export class Module {}
