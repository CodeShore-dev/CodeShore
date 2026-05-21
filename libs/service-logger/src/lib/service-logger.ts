import { ConsoleLogger, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as dayjs from 'dayjs';
import * as fs from 'fs';

import { Config } from './config';

@Injectable()
export class ServiceLogger extends ConsoleLogger {
  private colorful?: boolean;
  private directory?: string;
  private fileFormat?: string;
  private levels: string[];

  constructor(
    private readonly configService: ConfigService<Config>,
  ) {
    super();
    this.levels =
      this.configService.get<string[]>('logger_levels') ??
      [];
    this.colorful = this.configService.get<boolean>(
      'logger_colorful',
    );
    this.directory = this.configService.get<string>(
      'logger_directory',
    );
    this.fileFormat = this.configService.get<string>(
      'logger_file_format',
    );
  }

  base(
    level: 'debug' | 'log' | 'verbose' | 'warn' | 'error',
    message: object,
  ) {
    try {
      const now = new Date();
      let result = '';
      const isMatchingLogLevel =
        this.levels.includes(level);
      if (typeof message === 'object') {
        result = JSON.stringify({
          time: now.toISOString(),
          level,
          ...message,
        });
      } else if (typeof message === 'string') {
        result = message;
      }

      if (this.colorful) {
        super[level](result);
      } else if (
        this.levels.length === 0 ||
        isMatchingLogLevel
      ) {
        console.log(result);
      }

      if (this.directory && result) {
        appendLogs(result, {
          logDirectory: this.directory,
          logFileFormat: this.fileFormat,
        });
      }
    } catch (error) {
      if (message) {
        super.error({ level, error, ...message });
      }
    }
  }

  override debug(message: object) {
    const level = 'debug';
    this.base(level, message);
  }

  override log(message: object) {
    const level = 'log';
    this.base(level, message);
  }

  override verbose(message: object) {
    const level = 'verbose';
    this.base(level, message);
  }

  override error(message: object) {
    const level = 'error';
    this.base(level, message);
  }

  override warn(message: object) {
    const level = 'warn';
    this.base(level, message);
  }
}

export const appendLogs = (
  value: string,
  options: { logDirectory: string; logFileFormat?: string },
) => {
  if (!fs.existsSync(options.logDirectory)) {
    fs.mkdirSync(options.logDirectory, { recursive: true });
  }
  const fileName = new dayjs.Dayjs().format(
    options.logFileFormat ?? 'YYYY-MM-DD',
  );
  const logFilePath = `${options.logDirectory}/${fileName}.log`;
  fs.appendFileSync(logFilePath, `${value}\r\n`);
};
