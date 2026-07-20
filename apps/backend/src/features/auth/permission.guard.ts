import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AdminEmailGuard } from './admin-email.guard';
import { REQUIRE_PERMISSION_KEY } from './auth.decorator';

@Injectable()
export class PermissionGuard extends AdminEmailGuard {
  protected readonly metadataKey = REQUIRE_PERMISSION_KEY;
  protected readonly forbiddenMessage =
    'You do not have permission to perform this action';

  constructor(reflector: Reflector) {
    super(reflector);
  }
}
