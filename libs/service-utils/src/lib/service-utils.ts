import { Logger, ValidationPipe } from '@nestjs/common';
import {
  IEntryNestModule,
  NestFactory,
} from '@nestjs/core';
import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';

import { ServiceLogger } from '@codeshore/service-logger';
import { AllExceptionsFilter, InboundInterceptor } from '@codeshore/service-transport';

export async function bootstrap(
  AppModule: IEntryNestModule,
  {
    repo = 'unknown-service',
    port = 8080,
    ver = '0.0.0',
  }: { repo?: string; port?: number; ver?: string },
) {
  process.on('uncaughtException', err => {
    console.error('❌ Uncaught Exception:', err);
  });

  process.on('unhandledRejection', reason => {
    console.error('❌ Unhandled Rejection:', reason);
  });

  const prefix = 'api';

  const app = await NestFactory.create(AppModule);
  const logger = app.get(ServiceLogger);
  app.enableCors();
  app.setGlobalPrefix(prefix);
  app.useGlobalInterceptors(new InboundInterceptor(logger));
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  const options = new DocumentBuilder()
    .setTitle(`${repo} API`)
    .setDescription(
      `A Documentation for ${repo}(${ver}) API`,
    )
    .setVersion(ver)
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(
    app,
    options,
  );
  SwaggerModule.setup(prefix, app, document);

  await app.listen(port);
  Logger.log(
    `🚀 Application(${ver}) is running on: http://localhost:${port}/${prefix}`,
  );
}
