import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from '@supabase/supabase-js';

import { CurrentUser } from './auth.decorator';

@ApiBearerAuth()
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  @Get('me')
  getMe(@CurrentUser() user: User) {
    return user;
  }
}
