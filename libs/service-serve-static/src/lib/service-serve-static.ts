import { DynamicModule } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { getMetadata } from '@codeshore/service-utils';

export const getServeStaticModule = (
  repo: string | undefined,
): DynamicModule => {
  if (!repo) {
    return ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'frontend'),
      exclude: ['/api{/*path}'],
    });
  }
  const [folderName, name] = getMetadata(repo);
  const rootPath = join(__dirname, '..', folderName);
  const serveRoot = `/${name}`;
  const exclude = [`/${name}/api{/*path}`];
  return ServeStaticModule.forRoot({
    rootPath,
    serveRoot,
    exclude,
  });
};
