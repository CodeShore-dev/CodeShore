import compression = require('compression');
import { Logger } from '@nestjs/common';
import {
  IEntryNestModule,
  NestFactory,
} from '@nestjs/core';
import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';

// The frontend is same-origin in production (ServeStaticModule serves it
// from this same app) and only ever calls the API cross-origin from the
// local Vite dev server, so the allowlist only needs the prod domain plus
// the two local dev ports (`serve`/`preview`, see apps/frontend/vite.config.mts).
// CORS_ORIGINS lets a deployment add more (e.g. a staging domain) without a
// code change. Note this only restricts browser JS on other origins from
// reading responses -- curl/Postman/server-to-server calls are never subject
// to CORS, so this is not an access-control mechanism by itself.
const DEFAULT_ALLOWED_ORIGINS = [
  'https://codeshore.dev',
  'http://localhost:4200',
  'http://localhost:4300',
];

function resolveAllowedOrigins(): string[] {
  const extra = (process.env['CORS_ORIGINS'] ?? '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
  return [...DEFAULT_ALLOWED_ORIGINS, ...extra];
}

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
  // Gzips every response on the fly -- this is what actually compresses the
  // frontend's static JS/CSS bundle in production, since ServeStaticModule
  // (see @codeshore/service-serve-static) serves files as-is with no
  // built-in compression.
  app.use(compression());
  app.enableCors({ origin: resolveAllowedOrigins() });
  app.setGlobalPrefix(prefix);
  // InboundInterceptor / AllExceptionsFilter / the global ValidationPipe are
  // registered via DI (APP_INTERCEPTOR/APP_FILTER/APP_PIPE) by
  // TransportModule (see @codeshore/service-transport), imported into
  // AppModule -- not here -- so they can have dependencies (ServiceLogger)
  // injected instead of being constructed with `new X()` outside the
  // container.
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
