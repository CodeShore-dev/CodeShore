import { DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigObject } from '@nestjs/config';
import { existsSync, readFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { join } from 'path';

const YAML_CONFIG_FILENAME = 'assets/configs/config.yaml';

export const getAppConfigFromYAML = (
  defaultConfig: Partial<ConfigObject> = {},
) => {
  const filepath = join(__dirname, YAML_CONFIG_FILENAME);

  let records: Record<string, unknown> = {};
  if (existsSync(filepath)) {
    records = yaml.load(
      readFileSync(filepath, 'utf8'),
    ) as ConfigObject;
  } else {
    throw Error(
      `@codeshore/service-config requires config file (${filepath})`,
    );
  }
  return { ...defaultConfig, ...records };
};

export const getAppConfigModule = (
  defaultConfig: Partial<ConfigObject> = {},
): Promise<DynamicModule> =>
  ConfigModule.forRoot({
    load: [
      getAppConfigFromYAML.bind(undefined, defaultConfig),
    ],
  });
