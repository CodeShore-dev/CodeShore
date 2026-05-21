import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ServiceLogger } from './service-logger';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [ServiceLogger],
  exports: [ServiceLogger],
})
export class LoggerModule {}
