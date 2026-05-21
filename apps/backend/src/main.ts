import { bootstrap } from '@codeshore/service-utils';

import { AppModule } from './app/app.module';

bootstrap(AppModule, {
  repo: process.env.REPO,
  ver: process.env.VER,
});
