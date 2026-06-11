import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '@supabase/supabase-js';

import { CurrentUser } from './auth.decorator';

@ApiBearerAuth()
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  @Get('me')
  @ApiOperation({
    summary: 'Get the currently authenticated user',
    description:
      'Resolves the current Supabase user from the Bearer token and returns it as-is, including fields such as id, email and metadata. Requires a valid Authorization header.',
  })
  getMe(@CurrentUser() user: User) {
    return user;
  }
}
