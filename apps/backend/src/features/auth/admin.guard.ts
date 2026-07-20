import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AdminEmailGuard } from './admin-email.guard';
import { ADMIN_ONLY_KEY } from './auth.decorator';

@Injectable()
export class AdminGuard extends AdminEmailGuard {
  protected readonly metadataKey = ADMIN_ONLY_KEY;
  protected readonly forbiddenMessage =
    'This action is restricted to admin users';

  constructor(reflector: Reflector) {
    super(reflector);
  }
}
