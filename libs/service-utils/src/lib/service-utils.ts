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

/**
 * 建立並完整設定好 Nest app，但「不呼叫 listen」。
 * 給兩種 runtime 共用：
 *   - bootstrap()：傳統長駐伺服器（GCP Cloud Run / EC2）
 *   - Lambda handler：app.init() 後交給 serverless-express 包裝
 */
export async function createApp(
  AppModule: IEntryNestModule,
  {
    repo = 'unknown-service',
    ver = '0.0.0',
  }: { repo?: string; ver?: string } = {},
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

  return { app, prefix };
}

export async function bootstrap(
  AppModule: IEntryNestModule,
  {
    repo = 'unknown-service',
    port = 8080,
    ver = '0.0.0',
  }: { repo?: string; port?: number; ver?: string },
) {
  const { app, prefix } = await createApp(AppModule, { repo, ver });

  await app.listen(port);
  Logger.log(
    `🚀 Application(${ver}) is running on: http://localhost:${port}/${prefix}`,
  );
}
