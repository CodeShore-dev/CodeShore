import serverlessExpress from '@codegenie/serverless-express';
import type { Handler } from 'aws-lambda';

import { createApp } from '@codeshore/service-utils';

import { AppModule } from './app/app.module';

// Lambda 容器會重用同一個 process，把建好的 handler 快取起來，避免每次冷啟動重建 Nest app。
let cachedHandler: Handler;

async function bootstrapHandler(): Promise<Handler> {
  const { app } = await createApp(AppModule, {
    repo: process.env.REPO,
    ver: process.env.VER,
  });
  // 注意：Lambda 不呼叫 listen，改用 init() 後把底層 express app 交給 serverless-express
  await app.init();
  const expressApp = app.getHttpAdapter().getInstance();
  return serverlessExpress({ app: expressApp });
}

export const handler: Handler = async (event, context, callback) => {
  cachedHandler = cachedHandler ?? (await bootstrapHandler());
  return cachedHandler(event, context, callback);
};
