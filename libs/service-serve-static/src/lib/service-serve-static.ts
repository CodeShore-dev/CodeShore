import { DynamicModule } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

export const getServeStaticModule = (
  repo: string | undefined,
): DynamicModule => {
  if (!repo) {
    return ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'frontend'),
      exclude: ['/api{/*path}'],
    });
  }
  const rootPath = join(__dirname, '..', repo);
  const serveRoot = `/${repo}`;
  const exclude = [`/${repo}/api{/*path}`];
  return ServeStaticModule.forRoot({
    rootPath,
    serveRoot,
    exclude,
  });
};
