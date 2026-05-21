import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { User } from '@supabase/supabase-js';

import { CurrentUser } from './auth.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  @Get('me')
  getMe(@CurrentUser() user: User) {
    return {
      id: user.id,
      email: user.email,
      provider: user.app_metadata?.['provider'],
      avatarUrl: user.user_metadata?.['avatar_url'],
    };
  }
}
