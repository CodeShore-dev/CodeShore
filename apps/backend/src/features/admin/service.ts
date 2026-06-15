import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { spawn } from 'child_process';
import dayjs from 'dayjs';
import { Observable } from 'rxjs';

import {
  JobService,
  LocationAnomalyType,
  fetchLocationAnomalyJobs,
  getJobCrawlStats,
  getJobUpdateDateCounts,
} from '@codeshore/data-utils';

import { QueryDto } from '../query.dto';

const SALARY_SELECT =
  'id,title,detail_link,salary,salary_type,min_salary,max_salary,salary_manual,updated_at';
const LOCATION_SELECT =
  'id,title,detail_link,location,updated_at';
const DESCRIPTION_SELECT =
  'id,title,detail_link,updated_at';

const SAFE_ID = /^[A-Za-z0-9_-]+$/;
const SAFE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RECRAWL_IDS = 2000;
const MAX_RECRAWL_DATES = 366;

const DEFAULT_ORDER = [
  { column: 'updated_at', ascending: false },
];

const CONDITION_COLUMNS = new Set([
  'id',
  'title',
  'location',
  'salary',
  'salary_type',
  'min_salary',
  'max_salary',
  'description',
  'company_id',
  'closed',
  'created_at',
  'updated_at',
  'detail_link',
]);
const CONDITION_OPERATORS = new Set([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'like',
  'ilike',
  'is',
  'in',
]);

function splitTopLevel(expr: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of expr) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === sep && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function assertValidCondition(cond: string): void {
  const d1 = cond.indexOf('.');
  const d2 = cond.indexOf('.', d1 + 1);
  if (d1 < 1 || d2 < 0) {
    throw new BadRequestException(
      `Invalid condition: "${cond}" (expected col.op.value)`,
    );
  }
  const col = cond.slice(0, d1);
  const op = cond.slice(d1 + 1, d2);
  if (!CONDITION_COLUMNS.has(col)) {
    throw new BadRequestException(
      `Unsupported filter column: "${col}"`,
    );
  }
  if (!CONDITION_OPERATORS.has(op)) {
    throw new BadRequestException(
      `Unsupported filter operator: "${op}"`,
    );
  }
}

function validateWhereExpr(expr: string): string {
  const trimmed = expr.trim();
  if (!trimmed) {
    throw new BadRequestException(
      'Conditional re-crawl requires at least one condition',
    );
  }
  for (const cond of splitTopLevel(trimmed, ',')) {
    if (cond.startsWith('(') && cond.endsWith(')')) {
      cond
        .slice(1, -1)
        .split('|')
        .forEach(assertValidCondition);
    } else {
      assertValidCondition(cond);
    }
  }
  return trimmed;
}

export type CrawlMode =
  | 'crawl'
  | 'fresh'
  | 'recrawl-ids'
  | 'recrawl-anomaly'
  | 'recrawl-cond'
  | 'recrawl-dates';

export type AnomalyKind =
  | 'salary'
  | 'empty-description'
  | 'location-blank'
  | 'location-unmapped'
  | 'location-malformed';

export interface CrawlOptions {
  mode: CrawlMode;
  ids?: string[];
  kind?: AnomalyKind;
  monthCeil?: number;
  yearCeil?: number;
  maxLen?: number;
  where?: string;
  dates?: string[];
}

@Injectable()
export class Service {
  constructor(private readonly jobService: JobService) {}

  getStats(days = 7) {
    return getJobCrawlStats(days);
  }

  getUpdateDateCounts() {
    return getJobUpdateDateCounts();
  }

  async updateSalary(
    id: string,
    minSalary: number,
    maxSalary: number,
    salaryType: 'month' | 'year',
  ) {
    if (maxSalary < minSalary) {
      throw new BadRequestException(
        'max_salary must be >= min_salary',
      );
    }
    const { error } = await this.jobService.update({
      id,
      min_salary: minSalary,
      max_salary: maxSalary,
      salary_type: salaryType,
      salary_manual: true,
    });
    if (error) {
      throw new BadRequestException(error.message);
    }
    return {
      id,
      min_salary: minSalary,
      max_salary: maxSalary,
      salary_type: salaryType,
      salary_manual: true,
    };
  }

  getSalaryAnomalies(
    query: QueryDto,
    monthCeil: number,
    yearCeil: number,
    select = SALARY_SELECT,
  ) {
    const where = {
      closed: { eq: false },
      $or:
        `and(salary_type.eq.month,max_salary.gt.${monthCeil},max_salary.lt.9999999),` +
        `and(salary_type.eq.year,max_salary.gt.${yearCeil},max_salary.lt.9999999)`,
    };
    return this.jobService.fetch({
      from: query.from ?? 0,
      to: query.to ?? 10,
      where,
      orders: query.orders?.length
        ? query.orders
        : DEFAULT_ORDER,
      select,
    });
  }

  getEmptyDescriptionJobs(
    query: QueryDto,
    select = DESCRIPTION_SELECT,
  ) {
    return this.jobService.fetch({
      from: query.from ?? 0,
      to: query.to ?? 10,
      where: {
        closed: { eq: false },
        $or: 'description.is.null,description.eq.',
      },
      orders: query.orders?.length
        ? query.orders
        : DEFAULT_ORDER,
      select,
    });
  }

  getLocationAnomalies(
    type: LocationAnomalyType,
    maxLen: number,
    query: QueryDto,
    select = LOCATION_SELECT,
  ) {
    return fetchLocationAnomalyJobs(type, maxLen, {
      from: query.from ?? 0,
      to: query.to ?? 10,
      where: {},
      orders: query.orders?.length
        ? query.orders
        : DEFAULT_ORDER,
      select,
    });
  }

  private async resolveAnomalyIds(
    opts: CrawlOptions,
  ): Promise<string[]> {
    const fullQuery = {
      from: 0,
      to: -1,
      where: {},
      orders: [],
    } as QueryDto;

    let result: { id: string }[] = [];
    switch (opts.kind) {
      case 'salary':
        ({ result } = (await this.getSalaryAnomalies(
          fullQuery,
          opts.monthCeil ?? 1000000,
          opts.yearCeil ?? 12000000,
          'id',
        )) as any);
        break;
      case 'empty-description':
        ({ result } = (await this.getEmptyDescriptionJobs(
          fullQuery,
          'id',
        )) as any);
        break;
      case 'location-blank':
      case 'location-unmapped':
      case 'location-malformed':
        ({ result } = (await this.getLocationAnomalies(
          opts.kind.replace(
            'location-',
            '',
          ) as LocationAnomalyType,
          opts.maxLen ?? 30,
          fullQuery,
          'id',
        )) as any);
        break;
      default:
        throw new BadRequestException(
          `Unknown anomaly kind: ${opts.kind}`,
        );
    }
    return result.map(r => r.id);
  }

  private async buildCrawlArgs(
    opts: CrawlOptions,
  ): Promise<string[]> {
    switch (opts.mode) {
      case 'crawl':
        return ['crawl'];
      case 'fresh':
        return ['crawl=fresh'];
      case 'recrawl-ids':
        return [this.buildRecrawlIdsArg(opts.ids ?? [])];
      case 'recrawl-anomaly':
        return [
          this.buildRecrawlIdsArg(
            await this.resolveAnomalyIds(opts),
          ),
        ];
      case 'recrawl-cond': {
        const where = validateWhereExpr(opts.where ?? '');
        return [`re-crawl=${where}`];
      }
      case 'recrawl-dates':
        return [this.buildRecrawlDatesArg(opts.dates ?? [])];
      default:
        throw new BadRequestException(
          `Unknown crawl mode: ${opts.mode}`,
        );
    }
  }

  private buildRecrawlIdsArg(ids: string[]): string {
    const safe = ids
      .map(id => id?.trim())
      .filter(id => id && SAFE_ID.test(id));
    if (!safe.length) {
      throw new BadRequestException(
        'No valid job ids to re-crawl',
      );
    }
    if (safe.length > MAX_RECRAWL_IDS) {
      throw new BadRequestException(
        `Too many ids (max ${MAX_RECRAWL_IDS})`,
      );
    }
    return `re-crawl=id.in.(${safe.join(',')})`;
  }

  private buildRecrawlDatesArg(dates: string[]): string {
    const safe = dates
      .map(d => d?.trim())
      .filter(d => d && SAFE_DATE.test(d));
    if (!safe.length) {
      throw new BadRequestException(
        'No valid dates to re-crawl',
      );
    }
    if (safe.length > MAX_RECRAWL_DATES) {
      throw new BadRequestException(
        `Too many dates (max ${MAX_RECRAWL_DATES})`,
      );
    }
    const segments = safe.map(d => {
      const next = dayjs(d).add(1, 'day').format('YYYY-MM-DD');
      return `and(updated_at.gte.${d},updated_at.lt.${next})`;
    });
    return `re-crawl=(${segments.join('|')})`;
  }

  spawnCrawl(
    opts: CrawlOptions,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>(subscriber => {
      let child: ReturnType<typeof spawn> | null = null;

      const emitLine = (line: string) =>
        subscriber.next({
          data: { type: 'log', message: line },
        } as MessageEvent);

      const pipeChunk = (chunk: Buffer) =>
        chunk
          .toString()
          .split('\n')
          .filter(Boolean)
          .forEach(emitLine);

      (async () => {
        let args: string[];
        try {
          args = await this.buildCrawlArgs(opts);
        } catch (err: any) {
          subscriber.next({
            data: {
              type: 'error',
              message: err?.message ?? 'Invalid crawl options',
            },
          } as MessageEvent);
          subscriber.complete();
          return;
        }

        emitLine(`[admin] starting crawler: ${args.join(' ')}`);

        child = spawn(
          'node',
          ['dist/apps/crawler/main.js', ...args],
          { stdio: ['ignore', 'pipe', 'pipe'] },
        );

        child.stdout?.on('data', pipeChunk);
        child.stderr?.on('data', pipeChunk);

        child.on('close', code => {
          subscriber.next({
            data: { type: 'done', success: code === 0 },
          } as MessageEvent);
          subscriber.complete();
        });

        child.on('error', err => {
          subscriber.next({
            data: { type: 'error', message: err.message },
          } as MessageEvent);
          subscriber.complete();
        });
      })();

      return () => {
        child?.kill();
      };
    });
  }
}
