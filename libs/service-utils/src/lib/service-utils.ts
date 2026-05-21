import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';

import {
  InboundInterceptor,
  ServiceLogger,
} from '@codeshore/service-logger';

import { GlobalExceptionFilter } from './global-exception.filter';

/**
 * e.g. x-y-z-service
 * => ['x-y-z', 'xyz']
 * @param repo
 * @returns
 */
export const getMetadata = (repo: string) => [
  repo.replace(/-service$/, ''),
  repo.replace(/-(service)?/g, ''),
];

export async function bootstrap(
  AppModule: any,
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

  let [, prefix] = getMetadata(repo);
  prefix += repo ? '/api' : 'api';

  const app = await NestFactory.create(AppModule);
  const logger = app.get(ServiceLogger);
  app.useLogger(logger);
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
  app.useGlobalFilters(new GlobalExceptionFilter());

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
